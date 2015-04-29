#!/usr/bin/env python
from argparse import ArgumentParser
from subprocess import Popen, PIPE, call
import datetime
import sys
import json
import urllib2
import os

from bson import json_util as json_extended_util
import pymongo


dyno_url = "http://dyno.mongodb.parts/api/v1/results"



class MongoShellCommandError(Exception):
    """ Raised with the mongo shell comes back with an unexpected error
    """


class BenchrunError(Exception):
    """ Raised when benchrun has an internal error
    """


class BenchrunWarning(Exception):
    """ Raised when benchrun has an internal error
    """


def parse_arguments():
    usage = "python benchrun.py -f <list of test files> -t <list of thread counts>\n       run with --help for argument descriptions"
    parser = ArgumentParser(description="mongo-perf micro-benchmark utility", usage=usage)

    parser.add_argument('-f', '--testfiles', dest='testfiles', nargs="+",
                        help='Provide a list of js test files to run',
                        default=None)
    parser.add_argument('-t', '--threads', dest='threads', nargs="+",
                        help='Specify which thread configuration to use',
                        type=int, default=[1, 2, 4, 8, 12, 16])
    parser.add_argument('-m', '--multidb', dest='multidb',
                        help='Specify how many databases the test should use',
                        type=int, default=1)
    parser.add_argument('-c', '--multicoll', dest='multicoll',
                        help='Specify how many collections the test should use',
                        type=int, default=1)
    parser.add_argument('--trialTime', dest='seconds',
                        help='Specify how many seconds to run each trial',
                        type=int, default=5)
    parser.add_argument('--trialCount', dest='trials',
                        help='Specify how many trials to run',
                        type=int, default=1)
    parser.add_argument('--shard', dest='shard',
                        help='Specify shard cluster the test should use, 0 - no shard, 1 - shard with {_id: hashed}, 2 - shard with {_id: 1}',
                        type=int, default=0, choices=[0, 1, 2])
    parser.add_argument('-l', '--label', dest='reportlabel',
                        help='Specify the label for the report stats saved to bench_results db',
                        default='')
    parser.add_argument('--rhost', '--reporthost', dest='reporthost',
                        help='Host name of the mongod where the results will be saved',
                        default='localhost')
    parser.add_argument('--rport', '--reportport', dest='reportport',
                        help='Port of the mongod where the results will be saved',
                        default='27017')
    parser.add_argument('--host', dest='hostname',
                        help='hostname of the mongod/mongos under test',
                        default='localhost')
    parser.add_argument('-p', '--port', dest='port',
                        help='Port of the mongod/mongos under test',
                        default='27017')
    parser.add_argument('--replset', dest='replica_set',
                        help='replica set name of the mongod/mongos under test',
                        default=None)
    parser.add_argument('-s', '--shell', dest='shellpath',
                        help="Path to the mongo shell executable to use.",
                        default='mongo')
    parser.add_argument('--mongo-repo-path', dest='repo_path',
                        help='Path to a mongo repo to collect commit information',
                        default='/home/mongo-perf/mongo')
    parser.add_argument('--safe', dest='safeMode',
                        nargs='?', const='true', choices=['true', 'false'],
                        help='this option enables a call to GLE after every op instead of every 100 ops',
                        default='false')
    parser.add_argument('-w', dest='w',
                        help='w write concern',
                        type=int, default=0)
    parser.add_argument('-j', dest='j',
                        nargs='?', const='true', choices=['true', 'false'],
                        help='this option turns on the j write concern',
                        default='false')
    parser.add_argument('--writeCmd', dest='writeCmd',
                        nargs='?', const='true', choices=['true', 'false'],
                        help='this option turns on use of the write command instead of legacy write operations',
                        default='true')
    parser.add_argument('--dyno', dest='dyno', nargs='?', const='true', choices=['true', 'false'],
                        help='Enable or disable submitting to dyno',
                        default='false')
    parser.add_argument('--nodyno', dest='nodyno', action='store_true', help='dont submit test results to dyno - for backwards compatibility')
    parser.add_argument('--testFilter', dest='testFilter',
                        help='run just the specified tests/suites e.g. --testFilter "[\'insert\',\'remove\']" or "%%" for the kitchen sink',
                        default='\'sanity\'')
    parser.add_argument('--topology', dest='topology',
                        help='The topology name the test is being run against',
                        default='single_node')

    return parser


def get_shell_info(shell_path):
    """
    Get the mongo shells building information
    :param shell_path:
    :return: dictionary of the shells getBuildInfo command
    """
    cmdStr = 'printjson(getBuildInfo())'
    mongo_proc = Popen([shell_path, "--norc", "--quiet", "--nodb", "--eval", cmdStr], stdin=PIPE, stdout=PIPE,
                       stderr=PIPE)
    out, err = mongo_proc.communicate()
    return json.loads(out)


def get_server_info(hostname="localhost", port="27017", replica_set=None):
    """
    Get the mongod server build info and server status from the target mongod server
    :param hostname: the hostname the target database is running on (defaults to localhost)
    :param port: the port the target database is running on (defaults to 27017)
    :param replica_set: the replica set name the target database is using (defaults to none)
    :return: a tuple of the buildinfo and the server status
    """
    if replica_set is None:
        client = pymongo.MongoClient("mongodb://%s:%s/test" % (hostname, port))
    else:
        client = pymongo.MongoReplicaSetClient("mongodb://%s:%s/test?replicaSet=%s" % (hostname, port, replica_set))
    db = client.test
    server_build_info = db.command("buildinfo")
    server_status = db.command("serverStatus")
    client.close()
    return server_build_info, server_status


def to_json_date(string_datetime):
    return {"$date": string_datetime}


def cleanup_result_dates(results):
    if 'run_start_time' in results:
        results['run_start_time'] = to_json_date(results['run_start_time'])
    if 'run_end_time' in results:
        results['run_end_time'] = to_json_date(results['run_end_time'])
        # convert date/time stamps to $date
    for test in results['results']:
        if 'run_start_time' in test['results']:
            test['results']['run_start_time'] = to_json_date(test['results']['run_start_time'])
        if 'run_end_time' in test['results']:
            test['results']['run_end_time'] = to_json_date(test['results']['run_end_time'])
        for threadrun in test['results']:
            if 'run_start_time' in test['results'][threadrun]:
                test['results'][threadrun]['run_start_time'] = to_json_date(
                    test['results'][threadrun]['run_start_time'])
            if 'run_end_time' in test['results'][threadrun]:
                test['results'][threadrun]['run_end_time'] = to_json_date(test['results'][threadrun]['run_end_time'])
    return results


def send_results_to_dyno(results, label, write_options, test_bed, cmdstr, server_status, server_build_info,
                         shell_build_info, args):
    for test in results['results']:
        for threadrun in test['results']:
            if threadrun.isdigit():
                result = {
                    "harness": "mongo-perf",
                    "workload": test['name'],
                    "server_git_hash": test_bed["server_git_hash"],
                    "server_stats": None,
                    "server_version": test_bed["server_version"],
                    "attributes": {
                        "nThread": int(threadrun),
                        "trialTime": args.seconds,
                        "multidb": args.multidb,
                        "multiColl": args.multicoll,
                        "shard": args.shard,
                        "label": label,
                        "testfiles": args.testfiles,
                        "standardDeviation": test['results'][threadrun]['standardDeviation'],
                        "writeOptions": write_options
                    },
                    "start_time": results['run_start_time'],
                    "end_time": results['run_end_time'],
                    "summary": {
                        "all_nodes": {
                            "op_median": test['results'][threadrun]['median'],
                            "op_throughput": test['results'][threadrun]['ops_per_sec']
                        },
                        "nodes": None
                    },
                    "test_driver": {
                        "build_date": "",
                        "git_hash": test_bed["harness"]["client"]["git_hash"],
                        "version": test_bed["harness"]["client"]["version"]
                    },
                    "test_run_time": test['results'][threadrun]['elapsed_secs'],
                    "testbed": {
                        "servers": {
                            "mongod": [
                                {
                                    "hostinfo": {
                                        "extra": {},
                                        "os": {
                                            "type": server_build_info['sysInfo'].partition(' ')[0],
                                        },
                                        "system": {
                                            "hostname": server_status['host'],
                                        }
                                    },
                                    "serverinfo": server_build_info,
                                    "storageengine": {
                                        "name": test_bed["server_storage_engine"]
                                    }
                                }
                            ]
                        },
                        "type": "standalone"
                    },
                    "errors": results['errors']
                }
                req = urllib2.Request(dyno_url)
                req.add_header('Content-Type', 'application/json')
                urllib2.urlopen(req,
                                json.dumps(result,
                                           default=json_extended_util.default))
    return


def load_file_in_shell(subproc, file, echo=True):
    cmd = "load('%s')\n" % file
    if echo:
        print(cmd)
    subproc.stdin.write(cmd)
    line = subproc.stdout.readline().strip()
    if line != "true":
        raise MongoShellCommandError("unable to load file %s message was %s"
                                     % (file, line))


def _get_git_committed_date_from_local(git_hash, path):
    import git
    # Get commit info
    repo = git.Repo(path)
    # Use hash to get commit_date
    try:
        try:
            structTime = repo.commit(git_hash).committed_date
            committed_date = datetime.datetime(*structTime[:6])
        except:
            scalarTime = repo.commit(git_hash).committed_date
            committed_date = datetime.datetime.fromtimestamp(scalarTime)
    except:
        raise BenchrunWarning(
            "WARNING: could not find Git commit %s in repository %s. trying "
            "github" % (git_hash, path))
    return committed_date


def _get_git_committed_date_from_github(git_hash):
    from github import Github

    try:
        g = Github()
        repo = g.get_repo('mongodb/mongo')
        commit = repo.get_commit(git_hash)
        date = commit.commit.committer.date
    except Exception as e:
        raise BenchrunWarning("Warning: could not find Git commit %s in main "
                              "mongodb repo. Error: %s" % (git_hash, e.message))
    return date


def _get_git_committed_date(git_hash, path=None):
    try:
        if path is not None and os.path.exists(path):
            try:
                committed_date = _get_git_committed_date_from_local(git_hash,
                                                                    path)
            except BenchrunWarning as brw:
                print brw.message
                committed_date = _get_git_committed_date_from_github(git_hash)
        else:
            committed_date = _get_git_committed_date_from_github(git_hash)
    except BenchrunWarning as e:
        print e.message
        print "WARNING: setting git commit date to current date and time"
        committed_date = datetime.datetime.now()
    return committed_date


def main():
    parser = parse_arguments()
    args = parser.parse_args()

    if not args.testfiles:
        print("Must provide at least one test file."
              " Run with --help for details.")
        sys.exit(1)

    for testfile in args.testfiles:
        if not os.path.exists(testfile):
            print("A test file that was passed in does not exist: %s"
                  % testfile)
            sys.exit(1)

    if args.multidb < 1:
        print("MultiDB option must be greater than zero. Will be set to 1.")
        args.multidb = 1

    if args.multicoll < 1:
        print("MultiCollection option must be greater than zero."
              " Will be set to 1.")
        args.multicoll = 1

    if args.shard < 0:
        print("shard option must be [0, 2]. Will be set to 0.")
        args.shard = 0
    elif args.shard > 2:
        print("shard option must be [0, 2] . Will be set to 2.")
        args.shard = 2

    # Print version info.
    call([args.shellpath, "--norc", "--host", args.hostname, "--port", args.port, "--eval",
           "print('db version: ' + db.version());"
           " db.serverBuildInfo().gitVersion;"])
    print("")

    # get the server info and status
    (server_build_info, server_status) = get_server_info(hostname=args.hostname,
                                                         port=args.port,
                                                         replica_set=
                                                         args.replica_set)

    # Use hash to get commit_date
    committed_date = _get_git_committed_date(server_build_info['gitVersion'],
                                             args.repo_path)

    # universal schema Test Bed JSON
    test_bed = {}
    test_bed["harness"] = {}
    test_bed["harness"]["client"] = {}
    test_bed["harness"]["client"]["name"] = "mongo shell"
    test_bed["harness"]["name"] = "mongo-perf"
    test_bed["harness"]["version"] = "unknown"
    test_bed["harness"]["git_hash"] = "unknown"
    test_bed["server_git_commit_date"] = str(committed_date)

    # determine mongo shell version in use
    shell_build_info = get_shell_info(args.shellpath)
    test_bed["harness"]["client"]["version"] = shell_build_info['version']
    test_bed["harness"]["client"]["git_hash"] = shell_build_info['gitVersion']

    # determine mongod version in use
    test_bed["server_version"] = server_build_info['version']
    # determine mongod git hash in use
    test_bed["server_git_hash"] = server_build_info['gitVersion']
    test_bed["topology"] = args.topology
    # get the storage engine
    if 'storageEngine' in server_status:
        test_bed["server_storage_engine"] = server_status['storageEngine']['name']
    else:
        test_bed["server_storage_engine"] = 'mmapv0'

    # Open a mongo shell subprocess and load necessary files.
    mongo_proc = Popen([args.shellpath, "--norc", "--quiet", "--port",
                        args.port, "--host", args.hostname],
                        stdin=PIPE, stdout=PIPE)

    # load test files
    load_file_in_shell(mongo_proc, 'util/utils.js')
    for testfile in args.testfiles:
        load_file_in_shell(mongo_proc, testfile)

    # put all write options in a Map
    write_options = {}
    write_options["safeGLE"] = args.safeMode
    write_options["writeConcernJ"] = args.j
    write_options["writeConcernW"] = args.w
    write_options["writeCmdMode"] = args.writeCmd

    # Pipe commands to the mongo shell to kickoff the test.
    cmdstr = ("mongoPerfRunTests(" +
              str(args.threads) + ", " +
              str(args.multidb) + ", " +
              str(args.multicoll) + ", " +
              str(args.seconds) + ", " +
              str(args.trials) + ", " +
              "'" + args.reportlabel + "', " +
              str(args.testFilter) + ", " +
              "'" + args.reporthost + "', " +
              "'" + args.reportport + "', " +
              "'" + str(datetime.datetime.now()) + "', " +
              str(args.shard) + ", " +
              str(json.dumps(write_options)) + ", " +
              str(json.dumps(test_bed)) +
              ");\n")
    mongo_proc.stdin.write(cmdstr)
    print cmdstr
    mongo_proc.stdin.close()

    # Read test output.
    readout = False
    getting_results = False
    got_results = False
    line_results = ""
    for line in iter(mongo_proc.stdout.readline, ''):
        line = line.strip()
        if line == "@@@START@@@":
            readout = True
            getting_results = False
        elif line == "@@@END@@@":
            readout = False
            getting_results = False
        elif line == "@@@RESULTS_START@@@":
            readout = False
            getting_results = True
        elif line == "@@@RESULTS_END@@@":
            readout = False
            got_results = True
            getting_results = False
        elif readout:
            print line
        elif not got_results and getting_results:
            line_results += line

    if got_results and not args.nodyno and args.dyno == 'true':
        # Encode as mongodb-extended-json
        results = cleanup_result_dates(json.loads(line_results))
        # send results to dyno
        send_results_to_dyno(results, args.reportlabel, write_options, test_bed, cmdstr, server_status,
                             server_build_info, shell_build_info, args)
    print("Finished Testing.")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)
    sys.exit(0)

