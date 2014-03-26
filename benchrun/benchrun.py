# it's a marathon not a sprint bro

from argparse import ArgumentParser
from subprocess import Popen, PIPE, call


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
                        help="Specify how many databases the test should use.",
                        type=int, default=1)
    parser.add_argument('-r', '--report', dest='reportlabel',
                        help=("Specify whether report stats should be saved to bench_results db,"
                              "and the label to assign to those stats."),
                        default="")

    return parser.parse_known_args()


def main():
    args, extra_args = parse_arguments()

    if args.multidb < 1:
        print("MultiDB option must be greater than zero. Will be set to 1.")
        args.multidb = 1

    # Print version info.
    call(["mongo", "--eval",
          "print('db version: ' + db.version()); db.serverBuildInfo().gitVersion;"])
    print("")

    # Open a mongo shell subprocess and load necessary files.
    mongo_proc = Popen("mongo", stdin=PIPE, stdout=PIPE)
    mongo_proc.stdin.write("load('utils.js')\n")
    for testfile in args.testfiles:
        mongo_proc.stdin.write("load('" + testfile + "')\n")

    # Pipe commands to the mongo shell to kickoff the test.
    cmdstr = ("runTests(" +
              str(args.threads) + ", " +
              str(args.multidb) + ", " +
              "'" + str(args.reportlabel) + "'" +
              ");\n")
    mongo_proc.stdin.write(cmdstr)
    mongo_proc.stdin.close()

    # Read test output.
    readout = False
    for line in mongo_proc.stdout:
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
