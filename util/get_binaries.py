import platform
from tarfile import ReadError
from urllib2 import URLError, HTTPError
import argparse
import sys
import pickle
from datetime import datetime
import time
import os
from os import listdir
from urllib2 import urlopen
import tempfile
import zipfile
import tarfile
import shutil
from zipfile import BadZipfile

from pyquery import PyQuery as pq


class CurrentBinaries:
    def __init__(self, timestamp=None, branch=None, revision=None, os_type=None, distribution=None):
        self.timestamp = timestamp
        self.revision = revision
        self.branch = branch
        self.os_type = os_type
        self.distribution = distribution


class BinaryDownload:
    def __init__(self, link=None, timestamp=None, path=None, archive=None, archive_type=None):
        self.link = link
        self.timestamp = timestamp
        self.archive = archive
        self.archive_type = archive_type


class BinariesNotAvailableError(Exception):
    def __init__(self, value):
        self.value = value

    def __str__(self):
        return repr(self.value)


def get_available(os_type, branch=None, version=None, distribution=None, debug=False):
    """
    Populates the self.download information from the www.mogodb.org/dl site for the OS type passed into the class
    get the html for the downloads page and parse for the download link and the timestamp
    based on the pages structure of
    <tr>
        <td><a href="http://downloads.mongodb.org/osx/mongodb-osx-x86_64-v2.4-latest.tgz">osx/mongodb-osx-x86_64-v2.4-latest.tgz</a></td>
        <td>2014-09-03 10:18:19</td>
        <td>87899836</td>
        <td><a href="http://downloads.mongodb.org/osx/mongodb-osx-x86_64-v2.4-latest.tgz.md5">md5</a></td>
        <td></td>
        <td></td>
        <td></td>
    </tr>
    """
    # build up text to look for
    match = os_type + "/mongodb-" + os_type + "-x86_64"
    if distribution is not None:
        match += "-" + distribution

    if debug and os_type != "win32":
        match += "-debugsymbols"

    if branch is not None and branch != "master":
        match += "-" + branch + "-latest"
    elif version is not None:
        match += "-" + version.lstrip('r')
    else:
        match += "-latest"

    if os_type == "win32":
        match += ".zip"
        type = "zip"
    else:
        match += ".tgz"
        type = "tgz"

    d = pq(url='http://www.mongodb.org/dl/' + os_type + '/x86_64')
    for tr in d.items('tr'):
        a = tr.find('td').eq(0).find('a')
        if a.attr.href is None:
            continue
        if a.text().rstrip('\n') != match:
            continue
        ts_td = tr.find('td').eq(1)
        dt = time.mktime(datetime.strptime(ts_td.text().rstrip('\n'), '%Y-%m-%d %H:%M:%S').timetuple())
        available = BinaryDownload(link=a.attr.href, timestamp=dt, archive_type=type)
        return available
    raise BinariesNotAvailableError("Unable to find binaries matching %s" % match)


def get_binaries(download):
    """
    :param download:
    :return: the path to the latest file downloaded or gotten
    """
    # do the download if we need to now
    if download is not None:
        f = urlopen(download.link)
        # Open our local file for writing
        tmpfile = tempfile.mktemp()
        with open(tmpfile, "wb") as local_file:
            local_file.write(f.read())
        download.archive = tmpfile
    return download


def extract_zip_binaries(archive):
    archive_binaries_dir = None
    zfile = zipfile.ZipFile(archive)
    extract_dir = tempfile.mkdtemp()
    for name in zfile.namelist():
        (dirname, filename) = os.path.split(name)
        if os.path.basename(dirname) == "bin":
            full_dir_name = os.path.join(extract_dir, dirname)
            if archive_binaries_dir is None:
                archive_binaries_dir = full_dir_name
            if not os.path.exists(full_dir_name):
                os.makedirs(full_dir_name)
            zfile.extract(name, extract_dir)
    zfile.close()
    return (archive_binaries_dir, extract_dir)


def extract_tgz_binaries(archive):
    archive_binaries_dir = None
    tfile = tarfile.open(archive)
    extract_dir = tempfile.mkdtemp()
    for name in tfile.getnames():
        (dirname, filename) = os.path.split(name)
        if os.path.basename(dirname) == "bin":
            full_dir_name = os.path.join(extract_dir, dirname)
            if archive_binaries_dir is None:
                archive_binaries_dir = full_dir_name
            if not os.path.exists(full_dir_name):
                os.makedirs(full_dir_name)
            tfile.extract(name, extract_dir)
    tfile.close()
    return (archive_binaries_dir, extract_dir)


current_binaries = None
try:
    # setup command line arguments
    parser = argparse.ArgumentParser(description='Download MongoDB binaries')

    parser.add_argument('--dir', dest='download_dir', action='store', required=True,
                        help='the directory to download the binaries file to')
    parser.add_argument('--branch', dest='branch', action='store', default=None,
                        help='the branch to get the latest build for eg v2.6')
    parser.add_argument('--revision', dest='revision', action='store', default=None,
                        help='the version to get the binaries for')
    parser.add_argument('--distribution', dest='distribution', action='store', default=None,
                        help='the distribution to get the binaries for')
    parser.add_argument('--os', dest='os_type', action='store',
                        help='override the os to grab the binaries for (linux, osx, win32, sunos5)', default=None)
    args = parser.parse_args()

    # determine OS type if not passed in
    if args.os_type is None:
        if platform.system() == 'Windows':
            args.os_type = "win32"
        elif platform.system() == 'Linux':
            args.os_type = "linux"
        elif platform.system() == 'Darwin':
            args.os_type = "osx"
        else:
            args.os_type = "sunos5"

    # check for current version of downloaded binaries
    current_binaries_file = os.path.join(args.download_dir, '.current_binaries')
    if os.path.isfile(current_binaries_file):
        # get the las_download file and unserialize it
        pkl_file = open(current_binaries_file, 'rb')
        current_binaries = pickle.load(pkl_file)
        pkl_file.close()

    # get the available binaries
    available = get_available(args.os_type, branch=args.branch, version=args.revision, distribution=args.distribution)

    # see if we need to actually do the download based on
    # the check file and the directory
    do_download = False
    if current_binaries is not None:
        if current_binaries.revision != args.revision \
                or current_binaries.branch != args.branch \
                or current_binaries.distribution != args.distribution \
                or current_binaries.os_type != args.os_type \
                or current_binaries.timestamp < available.timestamp:
            do_download = True
            shutil.rmtree(args.download_dir)
    elif current_binaries is None and os.path.isdir(args.download_dir):
        shutil.rmtree(args.download_dir)
        do_download = True
    elif current_binaries is None and os.path.isdir(args.download_dir) is False:
        do_download = True

    # do the download
    if do_download:
        # get the archive
        download = get_binaries(available)

        # unarchive the download
        if download.archive_type == "zip":
            (archive_binaries_path, extract_dir) = extract_zip_binaries(download.archive)
        else:
            (archive_binaries_path, extract_dir) = extract_tgz_binaries(download.archive)

        # copy files to final path
        if os.path.isdir(args.download_dir) is False:
            os.makedirs(args.download_dir)
        for file in [f for f in listdir(archive_binaries_path) if
                     os.path.isfile(os.path.join(archive_binaries_path, f))]:
            shutil.copy(os.path.join(archive_binaries_path, file), args.download_dir)
        shutil.rmtree(extract_dir, ignore_errors=True)

        # cleanup archive
        os.remove(download.archive)

        # write the new binaries info to the checkfile
        current_binaries = CurrentBinaries(timestamp=download.timestamp, revision=args.revision, branch=args.branch,
                                           distribution=args.distribution, os_type=args.os_type)
        output = open(current_binaries_file, 'wb+')
        pickle.dump(current_binaries, output)
        output.close()
except (BinariesNotAvailableError, URLError, HTTPError, ReadError, BadZipfile) as e:
    sys.stderr.write(e.message)
    sys.exit(1)
sys.exit(0)
