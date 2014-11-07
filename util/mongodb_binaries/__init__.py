import copy
import os
import pickle
import platform
import shutil
import tarfile
import tempfile
import zipfile
from os import listdir
from urllib2 import urlopen

from mongodb_binaries.errors import BinariesNotAvailableError, \
    DownloadDirectoryExistsError

_CURRENT_BINARIES_FILE_NAME = '.current_binaries'

class CurrentBinaries:
    """CurrentBinaries class structure to get/save downloaded information"""

    # old style current binaries tracking file  only around for conversion
    # purposes

    def __init__(self, hash=None, branch=None, revision=None, os_type=None,
                 distribution=None, cpu_arch=None):
        self.md5 = None  # keeping around for backwards compatibility
        self.hash = hash
        self.revision = revision
        self.branch = branch
        self.os_type = os_type
        self.cpu_arch = cpu_arch
        self.distribution = distribution


class BinariesCriteria(object):
    """The Criteria used for downloading a set of binaries."""

    def __eq__(self, other):
        self_dict = copy.copy(self.__dict__)
        self_dict['hash'] = None
        other_dict = copy.copy(other.__dict__)
        other_dict['hash'] = None
        return (isinstance(other, self.__class__)
                and self_dict == other_dict)

    def __ne__(self, other):
        return not self.__eq__(other)

    def __init__(self, os_type=None, branch=None, version=None,
                 distribution=None, cpu_arch="x86_64", debug=False,
                 project=None, git_hash=None, variant=None):

        self.os_type = os_type
        self.variant = variant
        self.branch = branch
        self.version = version
        self.distribution = distribution
        self.cpu_arch = cpu_arch
        self.debug = debug
        self.project = project
        self.git_hash = git_hash
        self.hash = None

        # determine OS type if not passed in
        system_type = platform.system()
        if os_type is None and variant is None:
            if system_type == 'Windows':
                self.os_type = "win32"
                self.variant = "windows-64"
            elif system_type == 'Linux':
                self.os_type = "linux"
                self.variant = "linux-64"
            elif system_type == 'Darwin':
                self.os_type = "osx"
                self.variant = "osx-108"
            else:
                self.os_type = "sunos5"
                self.variant = "solaris-64-bit"

    @staticmethod
    def init_from_current_binaries(current_binaries):
        """
        Get a BinariesCriteria based on an old style CurrentBinaries for
        backwards compatibility
        :type current_binaries: CurrentBinaries
        :rtype: BinariesCriteria
        """
        criteria = BinariesCriteria(branch=current_binaries.branch,
                                    version=current_binaries.revision,
                                    os_type=current_binaries.os_type,
                                    cpu_arch=current_binaries.cpu_arch,
                                    distribution=current_binaries.distribution)
        if current_binaries.md5 is not None and current_binaries.hash is None:
            criteria.hash = current_binaries.md5
        else:
            criteria.hash = current_binaries.hash

        return criteria


class BinaryDownload(object):
    """Download of the binaries package """

    def __init__(self, link=None, archive=None, archive_type=None, hash=None):
        self.link = link
        self.hash = hash
        self.archive = archive
        self.archive_type = archive_type
        self.downloaded = False

    def download(self):
        """
        :rtype: bool whether the the download was successful
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
            archive_binaries_path, extract_dir = self.__extract_zip()
        else:
            archive_binaries_path, extract_dir = self.__extract_tgz()

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
        :return: a tuple with the path to the extracted archives bin dir
        and a path to the top level dir where it was extracted to
        """
        archive_binaries_dir = None
        zip_file = zipfile.ZipFile(self.archive)
        extract_dir = tempfile.mkdtemp()
        archive_binaries_dir = self.__create_extraction_dir(
            zip_file.namelist(), extract_dir, zip_file.extract)
        zip_file.close()
        return archive_binaries_dir, extract_dir

    def __extract_tgz(self):
        """
        Extracts the binaries form a compressed tar archive
        :return: a tuple with the path to the extracted archives bin dir
        and a path to the top level dir where it was extracted to
        """
        tar_file = tarfile.open(self.archive)
        extract_dir = tempfile.mkdtemp()
        archive_binaries_dir = self.__create_extraction_dir(
            tar_file.getnames(), extract_dir, tar_file.extract)
        tar_file.close()
        return archive_binaries_dir, extract_dir

    @staticmethod
    def __create_extraction_dir(names_list, extraction_dir,
                                extraction_function):
        archive_binaries_dir = None
        for name in names_list:
            directory_name, filename = os.path.split(name)
            if os.path.basename(directory_name) == "bin":
                full_dir_name = os.path.join(extraction_dir, directory_name)
                if archive_binaries_dir is None:
                    archive_binaries_dir = full_dir_name
                if not os.path.exists(full_dir_name):
                    os.makedirs(full_dir_name)
                extraction_function(name, extraction_dir)
        return archive_binaries_dir


class BinariesManager(object):
    """
    Manage a set of Binaries for a particular Directory
    """
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
        current_binaries_file = os.path.join(self.directory,
                                             _CURRENT_BINARIES_FILE_NAME)
        if os.path.isfile(current_binaries_file):
            # get the las_download file and unserialize it
            with open(current_binaries_file, 'rb') as pkl_file:
                current_binaries = pickle.load(pkl_file)
            if isinstance(current_binaries, CurrentBinaries):
                current_binaries = BinariesCriteria.init_from_current_binaries(
                    current_binaries)

        # see if we need to actually do the download based on
        # the check file and the directory
        do_download = False
        if current_binaries is not None:
            if current_binaries != criteria:
                do_download = True
                shutil.rmtree(self.directory)
        elif current_binaries is None and os.path.isdir(self.directory):
            raise DownloadDirectoryExistsError(
                "Binaries directory %s already exists and does not appear to "
                "be a tracked binaries directory."
                % self.directory)
        elif current_binaries is None and os.path.isdir(
                self.directory) is False:
            do_download = True

        if do_download:
            repo = RepositoryFactory.get_repo(criteria=criteria)
            download = repo.get_available()
            # make sure we really need to download
            if current_binaries is None \
                    or current_binaries.hash != download.hash:
                if download.download():
                    download.extract_to(self.directory)
                    download.clean()
                    criteria.hash = download.hash
                    with open(current_binaries_file, 'wb+') as output:
                        pickle.dump(criteria, output)

