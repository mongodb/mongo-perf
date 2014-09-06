import os
from binarydownloader import BinaryDownloader

downloader = BinaryDownloader(os.environ.get('BUILD_DIR', os.path.dirname(os.path.realpath(__file__))))
try:
    # sample calls
    # gets linux/mongodb-linux-x86_64-v2.6-latest.tgz
    #   downloader.getLatest("linux", branch="v2.6")
    #
    # gets linux/mongodb-linux-x86_64-ubuntu1204-debugsymbols-latest.tgz
    #   downloader.getLatest("linux", platform="ubuntu1204", debug=True)
    #
    # gets linux/mongodb-linux-x86_64-suse11-2.7.4.tgz
    #   downloader.getLatest("linux", version="2.7.4", platform="suse11")
    #
    # gets the latest master for suse 11 linux/mongodb-linux-x86_64-suse11-latest.tgz
    #   downloader.getLatest("linux", platform="suse11")
    #
    # gets the latest plain linux master
    downloader.getLatest("linux")
    # gets the latest plain Darwin/MacOSX master
    #downloader.getLatest("osx")
    # gets the latest plain Windows master
    #downloader.getLatest("win32")


except Exception, e:
    print e.message
