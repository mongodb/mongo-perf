from binarydownloader import BinaryDownloader

downloader = BinaryDownloader('linux')
try:
    downloader.getLatest()
except Exception:
    pass
