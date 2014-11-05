__author__ = 'brian'

import json
from string import Template
from urllib2 import URLError, urlopen

import yaml
import requests

from mongodb_binaries import BinaryDownload
from mongodb_binaries.errors import BinariesNotAvailableError


class RepositoryFactory(object):
    TYPE_MCI_LAST_GREEN = "lastgreen"
    TYPE_MCI = "mci"
    TYPE_RELEASE = "release"

    @staticmethod
    def get_repo(criteria):
        """
        :type criteria: BinariesCriteria
        :rtype: AbstractRepository
        """
        if criteria.project is not None and criteria.variant is not None and criteria.git_hash is not None:
            return MCIRepository(criteria)
        elif criteria.project is not None and criteria.variant is not None:
            return MCILatestGreenRepository(criteria)
        else:
            return ReleasesRepository(criteria)


class AbstractRepository(object):
    """Abstract base class for a Repository type
       It should always implement the get_available
       Its constructor should pass in any parameters needed
    """

    def __init__(self, criteria):
        """

        :type criteria: BinariesCriteria
        :return:
        """
        self.criteria = criteria

    def get_available(self):
        """
        :rtype: BinaryDownload
        """
        raise NotImplementedError("Should have implemented this")


class ReleasesRepository(AbstractRepository):
    DOT_ORG_DOWNLOAD_ROOT_URL = "http://downloads.mongodb.org/"

    def get_available(self):
        """
        Gets a BinaryDownload class with pulled from the www.mogodb.org/dl getting the current md5 sum of the
        binaries package.
        :rtype: BinaryDownload
        """
        # build up text to look for
        available = None
        match = self.DOT_ORG_DOWNLOAD_ROOT_URL + self.criteria.os_type + "/mongodb-" + self.criteria.os_type + "-" + self.criteria.cpu_arch
        if self.criteria.distribution is not None:
            match += "-" + self.criteria.distribution

        if self.criteria.debug and self.criteria.os_type != "win32":
            match += "-debugsymbols"

        if self.criteria.branch is not None and self.criteria.branch != "master":
            match += "-" + self.criteria.branch + "-latest"
        elif self.criteria.version is not None:
            match += "-" + self.criteria.version.lstrip('r')
        else:
            match += "-latest"

        if self.criteria.os_type == "win32":
            match += ".zip"
            type = "zip"
        else:
            match += ".tgz"
            type = "tgz"

        md5_match = match + ".md5"

        try:
            download_md5 = urlopen(md5_match).read()
            return BinaryDownload(link=match, hash=download_md5.partition(' ')[0], archive_type=type)
        except URLError as e:
            raise BinariesNotAvailableError("Error downloading md5 form %s: error: %s" % (md5_match, e.message))


class MCIRepository(AbstractRepository):
    MCI_ROOT_URL = "https://mci.mongodb.com/version_json/"

    def get_available(self):
        """

        :rtype: BinaryDownload
        """
        endpoint = self.MCI_ROOT_URL + self.criteria.project.replace("-", "_") + "_" + self.criteria.git_hash
        resp = requests.get(endpoint, cookies=self.get_id_cookies())
        if resp.status_code == 200:


            obj = json.loads(resp.text)
            found_variant = False
            found_compile = False
            compile_was_successful = False
            for variant_build in obj['Builds']:
                # find the right variant
                if variant_build['Build']['build_variant'] == self.criteria.variant:
                    found_variant = True
                    # find the compile task for that variant
                    for task in variant_build['Build']['tasks']:
                        if task['display_name'] == 'compile':
                            found_compile = True
                            # make sure the compile was a success
                            if task['status'] == 'success':
                                compile_was_successful = True
                                # compile was successful  get the binaries path url from the task
                                config = yaml.load(obj['Version']['config'])
                                # find the compile task in the config
                                for task in config['tasks']:
                                    if task['name'] == 'compile':
                                        for command in task['commands']:
                                            if command['command'] == 'attach.task_files':
                                                link_template = Template(command['params']['Binaries']
                                                                         .replace('ext|tgz', 'ext'))
                                                extension = self.__get_extension(config)
                                                link = link_template.substitute(revision=self.criteria.git_hash,
                                                                                build_id=variant_build['Build']['_id'],
                                                                                ext=extension,
                                                                                build_variant=self.criteria.variant)
                                                return BinaryDownload(link=link, hash=self.criteria.git_hash,
                                                                      archive_type=extension)
                            break
                    break
            if not found_variant:
                raise BinariesNotAvailableError(
                    "Unable to find variant %s for project %s" % (self.criteria.variant, self.criteria.project))
            elif not found_compile or not compile_was_successful:
                raise BinariesNotAvailableError(
                    "Unable to find successful compile on %s-%s for commit %s" % (
                        self.criteria.project, self.criteria.variant, self.criteria.git_hash))
        else:
            raise BinariesNotAvailableError(
                "Unable to find MCI binaries for %s %s" % (self.criteria.project, self.criteria.variant))

    def __get_extension(self, config):
        extenion = "tgz"
        for buildvariant in config['buildvariants']:
            if buildvariant['name'] == self.criteria.variant:
                if 'ext' in buildvariant['expansions']:
                    extenion = buildvariant['expansions']['ext']
        return extenion


    def get_id_cookies(self):
        try:
            from mci_tools_lib.auth_handler import crowd_get_id_token

            id_token = json.loads(crowd_get_id_token("mongodb-binaries"))
            return {'auth_user': id_token['auth_user'],
                    'auth_token': id_token['auth_token'],
                    'mci-token': id_token["auth_token"]}
        except ImportError:
            return {}


class MCILatestGreenRepository(MCIRepository):
    MCI_LAST_GREEN_ROOT = "https://mci.mongodb.com/json/last_green/"

    def __init__(self, criteria):
        super(MCILatestGreenRepository, self).__init__(criteria)
        self.criteria.git_hash = self.__get_last_green_git_hash(self.criteria.project, self.criteria.variant)

    def __get_last_green_git_hash(self, project, variant):
        endpoint = self.MCI_LAST_GREEN_ROOT + project + "?"
        endpoint += variant + "=1"
        resp = requests.get(endpoint, cookies=self.get_id_cookies())
        # resp = requests.get(endpoint)
        if resp.status_code == 200:
            obj = json.loads(resp.text)
            return obj['revision']
        else:
            raise BinariesNotAvailableError(
                "Unable to find latest green build for project %s variant %s" % (project, variant))




