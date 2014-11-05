__author__ = 'MongoDB, Inc.'

import os
from os import listdir
import zipfile
import tarfile
from urllib2 import urlopen
import tempfile
import shutil
import platform
import pickle
import copy

from mongodb_binaries.errors import BinariesNotAvailableError, DownloadDirectoryExistsError


class CurrentBinaries:
    """
    old style current binaries tracking file  only around for conversion purposes
    CurrentBinaries class structure to get/save downloaded information
    """

    def __init__(self, hash=None, branch=None, revision=None, os_type=None, distribution=None, cpu_arch=None):
        self.md5 = None  # keeping around for backwards compatibility
        self.hash = hash
        self.revision = revision
        self.branch = branch
        self.os_type = os_type
        self.cpu_arch = cpu_arch
        self.distribution = distribution


class BinariesCriteria(object):
    """
        The Criteria used for downloading a set of binaries.
    """
    version = None
    branch = None
    os_type = None
    cpu_arch = "x86_64"
    distribution = None
    debug = False
    project = None
    git_hash = None
    variant = None
    hash = None

    def __eq__(self, other):
        self_dict = copy.copy(self.__dict__)
        self_dict['hash'] = None
        other_dict = copy.copy(other.__dict__)
        other_dict['hash'] = None
        return (isinstance(other, self.__class__)
                and self_dict == other_dict)

    def __ne__(self, other):
        return not self.__eq__(other)

    def __init__(self, os_type=None, branch=None, version=None, distribution=None, cpu_arch="x86_64", debug=False,
                 project=None, git_hash=None, variant=None):
        # determine OS type if not passed in
        if os_type is None:
            if platform.system() == 'Windows':
                self.os_type = "win32"
                self.variant = "windows-64"
            elif platform.system() == 'Linux':
                self.os_type = "linux"
                self.variant = "linux-64"
            elif platform.system() == 'Darwin':
                self.os_type = "osx"
                self.variant = "osx-108"
            else:
                self.os_type = "sunos5"
                self.variant = "solaris-64-bit"
        self.branch = branch
        self.version = version
        self.distribution = distribution
        self.cpu_arch = cpu_arch
        self.debug = debug
        self.project = project
        self.git_hash = git_hash
        self.variant = variant

    @staticmethod
    def init_from_current_binaries(current_binaries):
        """
        Get a BinariesCriteria based on an old style CurrentBinaries for backwards compatability
        :type current_binaries: CurrentBinaries
        :rtype: BinariesCriteria
        """
        criteria = BinariesCriteria(branch=current_binaries.branch, version=current_binaries.revision,
                                    os_type=current_binaries.os_type, cpu_arch=current_binaries.cpu_arch,
                                    distribution=current_binaries.distribution)
        if current_binaries.md5 is not None and current_binaries.hash is None:
            criteria.hash = current_binaries.md5
        else:
            criteria.hash = current_binaries.hash

        return criteria


class BinaryDownload:
    """
    BinaryDownload class to capture
    """

    def __init__(self, link=None, archive=None, archive_type=None, hash=None):
        self.link = link
        self.hash = hash
        self.archive = archive
        self.archive_type = archive_type
        self.downloaded = False

    def download(self):
        """
        :param download: a valid BinaryDownload class with the link needed to grab the binaries
        :return: a BinaryDownload class with the archive path filled in to the valid downloaded archive
        """
        # do the download if we need to now
        if not self.downloaded and self.link is not None:
            f = urlopen(self.link)
            # Open our local file for writing
            tmpfile = tempfile.mktemp()
            with open(tmpfile, "wb") as local_file:
                local_file.write(f.read())
            self.archive = tmpfile
            self.downloaded = True
            return True
        return False

    def extract_to(self, path):
        if self.archive_type == "zip":
            (archive_binaries_path, extract_dir) = self.__extract_zip()
        else:
            (archive_binaries_path, extract_dir) = self.__extract_tgz()

        # copy files to final path
        if os.path.isdir(path) is False:
            os.makedirs(path)
        for file in [f for f in listdir(archive_binaries_path) if
                     os.path.isfile(os.path.join(archive_binaries_path, f))]:
            shutil.copy(os.path.join(archive_binaries_path, file), path)
        shutil.rmtree(extract_dir, ignore_errors=True)

    def clean(self):
        os.remove(self.archive)

    def __extract_zip(self):
        """
        Extracts the binaries from a zip archive
        :return: a tuple with the path to the extracted archives bin dir  and a path to the top level dir where it was extracted to
        """
        archive_binaries_dir = None
        zip_file = zipfile.ZipFile(self.archive)
        extract_dir = tempfile.mkdtemp()
        for name in zip_file.namelist():
            (directory_name, filename) = os.path.split(name)
            if os.path.basename(directory_name) == "bin":
                full_dir_name = os.path.join(extract_dir, directory_name)
                if archive_binaries_dir is None:
                    archive_binaries_dir = full_dir_name
                if not os.path.exists(full_dir_name):
                    os.makedirs(full_dir_name)
                zip_file.extract(name, extract_dir)
        zip_file.close()
        return archive_binaries_dir, extract_dir

    def __extract_tgz(self):
        """
        Extracts the binaries form a compressed tar archive
        :return: a tuple with the path to the extracted archives bin dir  and a path to the top level dir where it was extracted to
        """
        archive_binaries_dir = None
        tar_file = tarfile.open(self.archive)
        extract_dir = tempfile.mkdtemp()
        for name in tar_file.getnames():
            (directory_name, filename) = os.path.split(name)
            if os.path.basename(directory_name) == "bin":
                full_dir_name = os.path.join(extract_dir, directory_name)
                if archive_binaries_dir is None:
                    archive_binaries_dir = full_dir_name
                if not os.path.exists(full_dir_name):
                    os.makedirs(full_dir_name)
                tar_file.extract(name, extract_dir)
        tar_file.close()
        return archive_binaries_dir, extract_dir


class BinariesManager(object):
    """
    Manage a set of Binaries for a particular Directory
    """
    CURRENT_BINARIES_FILE_NAME = '.current_binaries'

    def __init__(self, directory):
        self.directory = directory

    def update(self, criteria):
        """
        :type criteria: BinariesCriteria
        :return:
        """
        from mongodb_binaries.repositories import RepositoryFactory

        current_binaries = None

        # check for current version of downloaded binaries
        current_binaries_file = os.path.join(self.directory, self.CURRENT_BINARIES_FILE_NAME)
        if os.path.isfile(current_binaries_file):
            # get the las_download file and unserialize it
            pkl_file = open(current_binaries_file, 'rb')
            current_binaries = pickle.load(pkl_file)
            pkl_file.close()
            if isinstance(current_binaries, CurrentBinaries):
                current_binaries = BinariesCriteria.init_from_current_binaries(current_binaries)

        # see if we need to actually do the download based on
        # the check file and the directory
        do_download = False
        if current_binaries is not None:
            if current_binaries != criteria:
                do_download = True
                shutil.rmtree(self.directory)
        elif current_binaries is None and os.path.isdir(self.directory):
            raise DownloadDirectoryExistsError(
                "Binaries directory %s already exists and does not appear to be a tracked binaries directory."
                % self.directory)
        elif current_binaries is None and os.path.isdir(self.directory) is False:
            do_download = True

        if do_download:
            repo = RepositoryFactory.get_repo(criteria=criteria)
            download = repo.get_available()
            # make sure we really need to download
            if current_binaries is None or current_binaries.hash != download.hash:
                if download.download():
                    download.extract_to(self.directory)
                    download.clean()
                    criteria.hash = download.hash
                    output = open(current_binaries_file, 'wb+')
                    pickle.dump(criteria, output)
                    output.close()

