__author__ = 'brian'

class BinariesNotAvailableError(Exception):
    """BinariesNotAvailableError Exception to be thrown when no Binary package is found
    """

class DownloadDirectoryExistsError(Exception):
    """ Raised when a download directory exists but doest not appear to be a binaries directory
    """