import os
from binarydownloader import BinaryDownloader

downloader = BinaryDownloader(os.environ.get('BUILD_DIR', os.path.dirname(os.path.realpath(__file__))))
try:
    downloader.getLatest("linux", version="2.7.4")
except Exception, e:
    print e.message
