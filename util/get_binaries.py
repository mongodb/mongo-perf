import os
from binarydownloader import BinaryDownloader

downloader = BinaryDownloader('sunos5', os.environ.get('BUILD_DIR', os.path.dirname(os.path.realpath(__file__))))
try:
    downloader.getLatest()
except Exception:
    pass
