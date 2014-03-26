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
                        help="Use if each thread should use a different db.",
                        type=int, default=1)

    return parser.parse_known_args()


def main():
    args, extra_args = parse_arguments()

    # Print version info.
    call(["mongo", "--eval",
          "print('db version: ' + db.version()); db.serverBuildInfo().gitVersion;"])
    print("")

    if args.multidb < 1:
        print("MultiDB option must be greater than zero. Will be set to 1.")
        args.multidb = 1

    for testfile in args.testfiles:
        # Open a mongo shell subprocess
        mongo_proc = Popen("mongo", stdin=PIPE, stdout=PIPE)
        mongo_proc.stdin.write("load('utils.js')\n")

        print(testfile + "\n===================")

        # Pipe commands to the mongo shell to kickoff the test.
        cmdstr = "load('" + testfile + "');\n"
        cmdstr += "runTests(" + str(args.threads) + ", " + str(args.multidb).lower() + ");\n"
        mongo_proc.stdin.write(cmdstr)
        mongo_proc.stdin.close()

        # Read test output.
        start, end = False, False
        for line in mongo_proc.stdout:
            line = line.strip()
            if line == "@@@START@@@":
                start = True
            elif line == "@@@END@@@":
                end = True
            elif start and not end:
                print line

        # Print newline after done with this test file.
        print("")

    print("Finished Testing.")


if __name__ == '__main__':
    main()
