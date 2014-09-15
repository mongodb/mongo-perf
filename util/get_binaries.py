import platform
from tarfile import ReadError
from urllib2 import URLError, HTTPError
import argparse
import sys
import pickle
import os
from os import listdir
from urllib2 import urlopen
import tempfile
import zipfile
import tarfile
import shutil
from zipfile import BadZipfile


class CurrentBinaries:
    """
    CurrentBinaries class structure to get/save downloaded information
    """

    def __init__(self, md5=None, branch=None, revision=None, os_type=None, distribution=None, cpu_arch=None):
        self.md5 = md5
        self.revision = revision
        self.branch = branch
        self.os_type = os_type
        self.cpu_arch = cpu_arch
        self.distribution = distribution


class BinaryDownload:
    """
    BinaryDownload class to capture
    """

    def __init__(self, link=None, archive=None, archive_type=None, md5=None):
        self.link = link
        self.md5 = md5
        self.archive = archive
        self.archive_type = archive_type


class BinariesNotAvailableError(Exception):
    """
    BinariesNotAvailableError Exception to be thrown when no Binary package is found
    """

    def __init__(self, value):
        self.value = value

    def __str__(self):
        return repr(self.value)


def get_available(os_type, branch=None, version=None, distribution=None, cpu_arch="x86_64", debug=False):
    """
    Gets a BinaryDownload class with pulled from the www.mogodb.org/dl site matching the needed binaries package.
    It gets the html for the downloads page and parse for the download link and the timestamp based on the pages
    structure of
    <tr>
        <td><a href="http://downloads.mongodb.org/osx/mongodb-osx-x86_64-v2.4-latest.tgz">osx/mongodb-osx-x86_64-v2.4-latest.tgz</a></td>
        <td>2014-09-03 10:18:19</td>
        <td>87899836</td>
        <td><a href="http://downloads.mongodb.org/osx/mongodb-osx-x86_64-v2.4-latest.tgz.md5">md5</a></td>
        <td></td>
        <td></td>
        <td></td>
    </tr>
    :param os_type: the os type to look for  should be osx, linux, win32, or sunos5
    :param branch: the branch to get the latest for eg. v2.6, v2.4, master.  Overrides version.
    :param version: the exact version to get the binaries for eg 2.6.4 or r2.4.6
    :param distribution: the distribution to get eg. suse11, rhel70, rhel62, ubuntu1404, debian71, amazon, 2008plus
    :param cpu_arch: the cpu_architecture to get (x86_64, i386, i686)
    :param debug: binary if we should grab the debug symbols version
    :return:
    """
    # build up text to look for
    available = None
    match = "http://downloads.mongodb.org/" + os_type + "/mongodb-" + os_type + "-" + cpu_arch
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

    md5_match = match + ".md5"

    try:
        download_md5 = urlopen(md5_match).read()
        available = BinaryDownload(link=match, md5=download_md5, archive_type=type)
    except URLError as e:
        raise BinariesNotAvailableError("Error downloading md5 form %s: error: %s" % (md5_match, e.message))
    return available


def get_binaries(download):
    """
    :param download: a valid BinaryDownload class with the link needed to grab the binaries
    :return: a BinaryDownload class with the archive path filled in to the valid downloaded archive
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
    """
    Extracts the binaries from a zip archive
    :param archive: the path to the archive to extract
    :return: a tuple with the path to the extracted archives bin dir  and a path to the top level dir where it was extracted to
    """
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
    """
    Extracts the binaries form a compressed tar archive
    :param archive: the path to the archive to extract
    :return: a tuple with the path to the extracted archives bin dir  and a path to the top level dir where it was extracted to
    """
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

#### Main Section ####
# set the temporary path to the local directory
tempfile.tempdir = os.path.dirname(os.path.realpath(__file__))
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
    parser.add_argument('--cpu', dest='cpu_arch', action='store',
                        help='grabs the CPU architecture (defaults to x86_64 can be i686', default="x86_64")
    parser.add_argument('--debug', action='store_true', help='if true grab the debugsymbols version of the binaries')

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
    available = get_available(args.os_type, branch=args.branch, version=args.revision, distribution=args.distribution,
                              cpu_arch=args.cpu_arch)

    # see if we need to actually do the download based on
    # the check file and the directory
    do_download = False
    if current_binaries is not None:
        if current_binaries.revision != args.revision \
                or current_binaries.branch != args.branch \
                or current_binaries.distribution != args.distribution \
                or current_binaries.os_type != args.os_type \
                or current_binaries.md5 != available.md5:
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
        current_binaries = CurrentBinaries(md5=download.md5, revision=args.revision, branch=args.branch,
                                           distribution=args.distribution, os_type=args.os_type)
        output = open(current_binaries_file, 'wb+')
        pickle.dump(current_binaries, output)
        output.close()
except (BinariesNotAvailableError, URLError, HTTPError, ReadError, BadZipfile) as e:
    sys.stderr.write(e.message)
    sys.exit(1)
sys.exit(0)
