import os
import platform
from binarydownloader import BinaryDownloader
import argparse


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

downloader = BinaryDownloader(args.download_dir)
try:
    # sample calls
    # gets linux/mongodb-linux-x86_64-v2.6-latest.tgz
    # downloader.getBinaries("linux", branch="v2.6")
    #
    # gets linux/mongodb-linux-x86_64-ubuntu1204-debugsymbols-latest.tgz
    # downloader.getBinaries("linux", platform="ubuntu1204", debug=True)
    #
    # gets linux/mongodb-linux-x86_64-suse11-2.7.4.tgz
    # downloader.getBinaries("linux", version="2.7.4", platform="suse11")
    #
    # gets the latest master for suse 11 linux/mongodb-linux-x86_64-suse11-latest.tgz
    # downloader.getBinaries("linux", platform="suse11")
    #
    # gets the latest plain linux master
    downloader.getBinaries(args.ostype, branch=args.branch, version=args.revision, platform=args.platform)

except Exception, e:
    print e.message
