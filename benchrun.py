#!/usr/bin/env python
from argparse import ArgumentParser
from subprocess import Popen, PIPE, call
import datetime
import sys
import json
import urllib2
import os



class MongoShellCommandError(Exception):
    """ Raised when the mongo shell comes back with an unexpected error
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
    parser.add_argument('--testFilter', dest='testFilter',
                        help='run just the specified tests/suites e.g. --testFilter "[\'insert\',\'remove\']" or "%%" for the kitchen sink',
                        default='\'sanity\'')
    parser.add_argument('--out', dest='outfile', help='write the results as json to the specified file')
    return parser


def load_file_in_shell(subproc, file, echo=True):
    cmd = "load('%s')\n" % file
    if echo:
        print(cmd)
    subproc.stdin.write(cmd)
    line = subproc.stdout.readline().strip()
    if line != "true":
        raise MongoShellCommandError("unable to load file %s message was %s"
                                     % (file, line))


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
    call([args.shellpath, "--norc", "--port", args.port, "--eval",
          "print('db version: ' + db.version());"
          " db.serverBuildInfo().gitVersion;"])
    print("")


    # Open a mongo shell subprocess and load necessary files.
    mongo_proc = Popen([args.shellpath, "--norc", "--quiet", "--port", args.port], stdin=PIPE, stdout=PIPE)

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
              str(json.dumps(args.testFilter)) + ", " +
              str(args.shard) + ", " +
              str(json.dumps(write_options)) +
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

    print("Finished Testing.")
    results_parsed = json.loads(line_results)
    if args.outfile:
        out = open(args.outfile, 'w')
        json.dump(results_parsed, out, indent=4, separators=(',', ': '))
        out.close()
    else:
        print json.dumps(results_parsed, indent=4, separators=(',', ': '))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)
    sys.exit(0)

