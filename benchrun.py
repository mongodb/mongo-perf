from argparse import ArgumentParser
from subprocess import Popen, PIPE, call
import datetime
import sys
import json

import git
import pymongo


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
    parser.add_argument('-p', '--port', dest='port',
                        help='Port of the mongod/mongos under test',
                        default='27017')
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

    return parser


def get_shell_info(shell_path):
    """
    Get the mongo shells building information
    :param shell_path:
    :return: dictionary of the shells getBuildInfo command
    """
    cmdStr = 'printjson(getBuildInfo())'
    mongo_proc = Popen([shell_path, "--norc", "--quiet", "--eval", cmdStr], stdin=PIPE, stdout=PIPE, stderr=PIPE)
    out, err = mongo_proc.communicate()
    return json.loads(out)


def get_server_info(hostname="localhost", port="27017", replica_set="none"):
    """
    Get the mongod server build info and server status from the target mongod server
    :param hostname: the hostname the target database is running on (defaults to localhost)
    :param port: the port the target database is running on (defaults to 27017)
    :param replica_set: the replica set name the target database is using (defaults to none)
    :return: a tuple of the buildinfo and the server status
    """
    if replica_set == 'none':
        client = pymongo.MongoClient("mongodb://%s:%s/test" % (hostname, port))
    else:
        client = pymongo.MongoReplicaSetClient("mongodb://%s:%s/test?replicaSet=%s" % (hostname, port, replica_set))
    db = client.test
    server_build_info = db.command("buildinfo")
    server_status = db.command("serverStatus")
    client.close()
    return server_build_info, server_status


def main():
    parser = parse_arguments()
    args = parser.parse_args()

    if not args.testfiles:
        print("Must provide at least one test file. Run with --help for details.")
        sys.exit(1)

    if args.multidb < 1:
        print("MultiDB option must be greater than zero. Will be set to 1.")
        args.multidb = 1

    if args.shard < 0:
        print("shard option must be [0, 2]. Will be set to 0.")
        args.shard = 0
    elif args.shard > 2:
        print("shard option must be [0, 2] . Will be set to 2.")
        args.shard = 2

    # Print version info.
    call([args.shellpath, "--norc", "--port", args.port, "--eval",
          "print('db version: ' + db.version()); db.serverBuildInfo().gitVersion;"])
    print("")

    # Get commit info
    repo = git.Repo(args.repo_path)
    # Get buildinfo in order to get commit hash
    client = pymongo.MongoClient()
    build_info = client['test'].command("buildinfo")
    commit_hash = build_info['gitVersion']
    # Use hash to get commit_date
    try:
        try:
            structTime = repo.commit(commit_hash).committed_date
            committed_date = datetime.datetime(*structTime[:6])
        except:
            scalarTime = repo.commit(commit_hash).committed_date
            committed_date = datetime.datetime.fromtimestamp(scalarTime)
    except:
        print "WARNING: could not find Git commit", commit_hash, "in", args.repo_path
        print "         substituting current date / time"
        committed_date = datetime.datetime.now()

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

    # get the server info and status
    (server_build_info, server_status) = get_server_info()
    # determine mongod version in use
    test_bed["server_version"] = server_build_info['version']
    # determine mongod git hash in use
    test_bed["server_git_hash"] = server_build_info['gitVersion']
    # get the storage engine
    if 'storageEngine' in server_status:
        test_bed["server_storage_engine"] = server_status['storageEngine']['name']
    else:
        test_bed["server_storage_engine"] = 'mmapv0'

    # Open a mongo shell subprocess and load necessary files.
    mongo_proc = Popen([args.shellpath, "--norc", "--port", args.port], stdin=PIPE, stdout=PIPE)
    mongo_proc.stdin.write("load('util/utils.js')\n")
    print "load('util/utils.js')"
    for testfile in args.testfiles:
        mongo_proc.stdin.write("load('" + testfile + "')\n")
        print "load('" + testfile + "')"

    # put all write options in a Map
    write_options = {}
    write_options["safeGLE"] = args.safeMode
    write_options["writeConcernJ"] = args.j
    write_options["writeConcernW"] = args.w
    write_options["writeCmdMode"] = args.writeCmd

    # Pipe commands to the mongo shell to kickoff the test.
    cmdstr = ("runTests(" +
              str(args.threads) + ", " +
              str(args.multidb) + ", " +

              str(args.seconds) + ", " +
              str(args.trials) + ", " +
              "'" + args.reportlabel + "', " +
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
    for line in iter(mongo_proc.stdout.readline, ''):
        line = line.strip()
        if line == "@@@START@@@":
            readout = True
        elif line == "@@@END@@@":
            readout = False
        elif readout:
            print line

    print("Finished Testing.")


if __name__ == '__main__':
    main()
