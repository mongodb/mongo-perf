import copy
import os
import pickle
import platform
import shutil

import repositories
from mongodb_binaries.errors import (BinariesNotAvailableError,
                                     DownloadDirectoryExistsError)
from mongodb_binaries.repositories import (MCIRepository,
                                           MCILatestSuccessfulTasksRepository,
                                          MCILatestGreenRepository,
                                          ReleasesRepository)


_CURRENT_BINARIES_FILE_NAME = '.current_binaries'


def get_repo(criteria):
    """
    :type criteria: BinariesCriteria
    :rtype: AbstractRepository
    """
    if (criteria.project is not None and criteria.variant is not None
            and criteria.git_hash is not None):
        return MCIRepository(criteria)
    elif (criteria.project is not None and criteria.variant is not None
            and criteria.tasks):
        return MCILatestSuccessfulTasksRepository(criteria)
    elif criteria.project is not None and criteria.variant is not None:
        return MCILatestGreenRepository(criteria)
    else:
        return ReleasesRepository(criteria)


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
                 project=None, git_hash=None, variant=None, tasks=[]):

        self.os_type = os_type
        self.variant = variant
        self.branch = branch
        self.version = version
        self.distribution = distribution
        self.cpu_arch = cpu_arch
        self.debug = debug
        self.project = project
        self.git_hash = git_hash
        self.tasks = tasks
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
        """Get a BinariesCriteria based on an old style CurrentBinaries.

        For backwards compatibility (with what?).

        :Parameters:
          - `current_binaries`: A CurrentBinaries instance

        :Returns:
          An instance of BinariesCriteria
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


class BinariesManager(object):
    """
    Manage a set of Binaries for a particular Directory
    """

    def __init__(self, directory):
        self.directory = directory
        self.current_download = None
        self.requested_criteria = None

    def update(self, criteria):
        """
        :type criteria: BinariesCriteria
        :return:
        """
        current_binaries = None

        # check for current version of downloaded binaries
        current_binaries_file = os.path.join(self.directory,
                                             _CURRENT_BINARIES_FILE_NAME)
        if os.path.isfile(current_binaries_file):
            # get the current binaries file file and unserialize it
            with open(current_binaries_file, 'rb') as pkl_file:
                current_binaries = pickle.load(pkl_file)
            if isinstance(current_binaries, CurrentBinaries):
                current_binaries = BinariesCriteria.init_from_current_binaries(
                    current_binaries)

        # see if we need to actually do the download based on
        # the check file and the directory
        repo = get_repo(criteria=criteria)
        self.current_download = repo.get_available()
        self.requested_criteria = repo.criteria

        do_download = False
        if current_binaries is not None:
            if current_binaries != repo.criteria:
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
            # make sure we really need to download
            if (current_binaries is None
                    or current_binaries.hash != self.current_download.hash):
                if self.current_download.download():
                    self.current_download.extract_to(self.directory)
                    self.current_download.clean()
                    repo.criteria.hash = self.current_download.hash
                    with open(current_binaries_file, 'wb+') as output:
                        pickle.dump(repo.criteria, output)

