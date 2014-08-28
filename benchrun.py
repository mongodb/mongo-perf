from argparse import ArgumentParser
from subprocess import Popen, PIPE, call
import git
import datetime
import platform
import pymongo
import sys


def parse_arguments():
    usage = "python benchrun.py -f <list of test files> -t <list of thread configurations>"
    parser = ArgumentParser(description="Performance testing script framework thing.", usage=usage)

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
    parser.add_argument('-l', '--label', dest='reportlabel',
                        help='Specify the label for the report stats saved to bench_results db',
                        default='')
    parser.add_argument('--rhost', '--reporthost', dest='reporthost',
                        help='Host name of the mongod where the results will be saved',
                        default='localhost')
    parser.add_argument('--rport', '--reportport', dest='reportport',
                        help='Port of the mongod where the results will be saved',
                        default='27017')
    parser.add_argument('-s', '--shell', dest='shellpath',
                        help="Path to the mongo shell executable to use.",
                        default='mongo')
    parser.add_argument('--mongo-repo-path', dest='repo_path',
                        help='Path to a mongo repo to collect commit information',
                        default='/home/mongo-perf/mongo')
    parser.add_argument('--safe', dest='safeMode',
                        help='Call GLE after every op instead of every 100 ops',
                        type=bool, default=False)
    parser.add_argument('-w', dest='w',
                        help='w write concern',
                        type=int, default=0)
    parser.add_argument('-j', dest='j',
                        help='j write concern',
                        type=bool, default=False)
    parser.add_argument('--writeCmd', dest='writeCmd',
                        help='use write command ILO legacy op',
                        type=bool, default=False)

    return parser.parse_known_args()


def main():
    args, extra_args = parse_arguments()

    if not args.testfiles:
        print("Must provide at least one test file. Run with --help for details.")
        sys.exit(1)

    if args.multidb < 1:
        print("MultiDB option must be greater than zero. Will be set to 1.")
        args.multidb = 1

    # Print version info.
    call([args.shellpath, "--norc", "--eval",
          "print('db version: ' + db.version()); db.serverBuildInfo().gitVersion;"])
    print("")

    # Get commit info
    repo = git.Repo(args.repo_path)
    # Get buildinfo in order to get commit hash
    client = pymongo.MongoClient()
    buildinfo = client['test'].command("buildinfo")
    commithash = buildinfo['gitVersion']
    # Use hash to get commit_date
    if platform.system() == 'Darwin' or platform.system() == 'Windows' or platform.system() == 'Linux':
      structTime = repo.commit(commithash).committed_date
      committed_date = datetime.datetime(*structTime[:6])
    else:
      scalarTime = repo.commit(commithash).committed_date
      committed_date = datetime.datetime.fromtimestamp(scalarTime)

    # Open a mongo shell subprocess and load necessary files.
    mongo_proc = Popen([args.shellpath, "--norc"], stdin=PIPE, stdout=PIPE)
    mongo_proc.stdin.write("load('util/utils.js')\n")
    print "load('util/utils.js')"
    for testfile in args.testfiles:
        mongo_proc.stdin.write("load('" + testfile + "')\n")
        print "load('" + testfile + "')"

    # map booleans
    if args.safeMode:
        safeMode = 'true'
    else:
        safeMode = 'false'
    if args.j:
        j = 'true'
    else:
        j = 'false'
    if args.writeCmd:
        writeCmd = 'true'
    else:
        writeCmd = 'false'

    # Pipe commands to the mongo shell to kickoff the test.
    cmdstr = ("runTests(" +
              str(args.threads) + ", " +
              str(args.multidb) + ", " +
              str(args.seconds) + ", " +
              str(args.trials) + ", " +
              "'" + args.reportlabel + "', " +
              "'" + args.reporthost + "', " +
              "'" + args.reportport + "', " +
              "'" + str(committed_date) + "', " +
              str(safeMode) + ", " +
              str(args.w) + ", " +
              str(j) + ", " +
              str(writeCmd) +
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
