# it's a marathon not a sprint bro

from argparse import ArgumentParser
from subprocess import check_output
from os import remove


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

    if args.multidb < 1:
        print("MultiDB option must be greater than zero. Will be set to 1.")
        args.multidb = 1

    # For some reason, using NamedTemporaryFile will not work here.
    # The NamedTemporaryFile won't run properly when it's passed to the mongo shell.
    runfile = open("totally_temp.js", 'w')
    runfile.write("runTests(" + str(args.threads) + ", " + str(args.multidb).lower() + ");")
    runfile.close()

    for testfile in args.testfiles:
        print("\n" + testfile + "\n===================")
        shellcmd = "mongo " + testfile + " utils.js " + runfile.name
        # For some reason, using Popen or call will not work here.
        # Even if I redirect STDOUT somewhere sensible, it just disappears.
        print(check_output(shellcmd, shell=True))

    # Sort of dangerous, probably. Oh well.
    # Other people probably won't name their files like a Valley Girl so I'm probably safe.
    remove("totally_temp.js")
    print("Finished Testing.")


if __name__ == '__main__':
    main()