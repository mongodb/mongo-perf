import os
import platform
from binarydownloader import BinaryDownloader
import argparse
import sys


parser = argparse.ArgumentParser(description='Download MongoDB binaries')

parser.add_argument('--dir', dest='download_dir', action='store', required=True,
                    help='the directory to download the binaries file to')
parser.add_argument('--branch', dest='branch', action='store', default=None,
                    help='the branch to get the latest build for eg v2.6')
parser.add_argument('--revision', dest='revision', action='store', default=None,
                    help='the version to get the binaries for')
parser.add_argument('--platform', dest='platform', action='store', default=None,
                    help='the platform to get the binaries for')
parser.add_argument('--ostype', dest='ostype', action='store',
                    help='override the os to grab the binaries for (linux, osx, win32, sunos5)', default=None)

args = parser.parse_args()

if args.ostype is None:
    if platform.system() == 'Windows':
        args.ostype = "win32"
    elif platform.system() == 'Linux':
        args.ostype = "linux"
    elif platform.system() == 'Darwin':
        args.ostype = "osx"
    else:
        args.ostype = "sunos5"

outpath = None
downloader = BinaryDownloader(args.download_dir)
try:
    outpath = downloader.getBinaries(args.ostype, branch=args.branch, version=args.revision, platform=args.platform)
    sys.stdout.write(outpath)
except Exception, e:
    sys.stderr.write(e.message)
    sys.exit(1)
sys.exit(0)
