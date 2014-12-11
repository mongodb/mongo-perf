import collections
import copy
import json
import requests
import yaml

from mongodb_binaries.utils import BinaryDownload
from mongodb_binaries.errors import BinariesNotAvailableError
from string import Template
from urllib2 import URLError, urlopen

_HAS_MCI_TOOLS = True
try:
    from mci_tools_lib.auth_handler import crowd_get_id_token
except ImportError:
    _HAS_MCI_TOOLS = False

try:
    from collections import OrderedDict
except ImportError:
    from ordereddict import OrderedDict

_DOT_ORG_DOWNLOAD_ROOT_URL = "http://downloads.mongodb.org/"
_MCI_ROOT_URL = "https://mci.mongodb.com/version_json/"
_MCI_LAST_SUCCESSFUL_COMPILE_ROOT = \
    "https://mci.mongodb.com/rest/v1/tasks/compile/history?project="
_MCI_LAST_GREEN_ROOT = "https://mci.mongodb.com/json/last_green/"
_MCI_VERSION_HISTORY_ROOT = "https://mci.mongodb.com/rest/v1/projects/"
_MCI_VERSION_STATUS_ROOT = "https://mci.mongodb.com/rest/v1/versions/"


def get_mci_id_cookies():
    """Login to MCI if the mci-tools library is available"""
    if _HAS_MCI_TOOLS:
        id_token = json.loads(crowd_get_id_token("mongodb-binaries"))
        return {'auth_user': id_token['auth_user'],
                'auth_token': id_token['auth_token'],
                'mci-token': id_token["auth_token"]}
    else:
        return {}


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
    def get_available(self):
        """
        Gets a BinaryDownload class with pulled from the www.mogodb.org/dl
        getting the current md5 sum of the binaries package.
        :rtype: BinaryDownload
        """
        # build up text to look for
        available = None
        match = "".join([_DOT_ORG_DOWNLOAD_ROOT_URL, self.criteria.os_type,
                         "/mongodb-", self.criteria.os_type, "-",
                         self.criteria.cpu_arch])
        if self.criteria.distribution is not None:
            match += "-" + self.criteria.distribution

        if self.criteria.debug and self.criteria.os_type != "win32":
            match += "-debugsymbols"

        if (self.criteria.branch is not None
            and self.criteria.branch != "master"):
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
            return BinaryDownload(link=match,
                                  hash=download_md5.partition(' ')[0],
                                  archive_type=type)
        except URLError as e:
            raise BinariesNotAvailableError(
                "Error downloading md5 form %s: error: %s" % (
                    md5_match, e.message))


class MCIRepository(AbstractRepository):
    def get_available(self):
        """

        :rtype: BinaryDownload
        """
        endpoint = "".join(
            [_MCI_ROOT_URL, self.criteria.project.replace("-", "_"), "_",
             self.criteria.git_hash])
        resp = requests.get(endpoint, cookies=get_mci_id_cookies())
        if resp.status_code == 200:
            return self.__get_download_from_mci_run(resp.text)
        else:
            raise BinariesNotAvailableError(
                "Unable to find MCI binaries for %s %s" % (
                    self.criteria.project, self.criteria.variant))

    def __get_download_from_mci_run(self, build_results_json):
        """Parse the MCI run results and get the BinaryDownload that has the
        artifacts for a successful compile
        """
        build_results = json.loads(build_results_json)
        found_variant = False
        found_compile = False
        compile_was_successful = False
        for variant_build in build_results['Builds']:
            # find the right variant
            variant = variant_build['Build']['build_variant']
            if variant == self.criteria.variant:
                found_variant = True
                # find the compile task for that variant
                for task in variant_build['Build']['tasks']:
                    if task['display_name'] == 'compile':
                        found_compile = True
                        # make sure the compile was a success
                        if task['status'] == 'success':
                            compile_was_successful = True
                            # compile was successful  get the binaries path
                            # url from the task
                            return self.__get_download_from_mci_config(
                                build_results['Version']['config'],
                                variant_build['Build']['_id'])
                        break
                break
        if not found_variant:
            raise BinariesNotAvailableError(
                "Unable to find variant %s for project %s" % (
                    self.criteria.variant, self.criteria.project))
        elif not found_compile or not compile_was_successful:
            raise BinariesNotAvailableError(
                "Unable to find successful compile on %s-%s for commit %s" % (
                    self.criteria.project, self.criteria.variant,
                    self.criteria.git_hash))

    def __get_download_from_mci_config(self, mci_config, build_id):
        """Parse the MCI config for a build job return a BinaryDownload object
         with the proper link to the artifacts of the build.

        :type mci_config: str version of the MCI config
        :type build_id: str of the MCI build id
        :rtype: BinaryDownload
        """
        config = yaml.load(mci_config)
        # find the compile task in the config
        for task in config['tasks']:
            if task['name'] == 'compile':
                for command in task['commands']:
                    if command['command'] == 'attach.task_files':
                        link_template = Template(
                            command['params']['Binaries']
                            .replace('ext|tgz', 'ext'))
                        extension = self.__get_extension(config)
                        link = link_template.substitute(
                            revision=self.criteria.git_hash,
                            build_id=build_id,
                            ext=extension,
                            build_variant=self.criteria.variant)
                        return BinaryDownload(
                            link=link,
                            hash=self.criteria.git_hash,
                            archive_type=extension)

    def __get_extension(self, config):
        extenion = "tgz"
        for buildvariant in config['buildvariants']:
            if buildvariant['name'] == self.criteria.variant:
                if 'ext' in buildvariant['expansions']:
                    extenion = buildvariant['expansions']['ext']
        return extenion

    def _get_version_history(self, project):
        endpoint = _MCI_VERSION_HISTORY_ROOT + project + "/versions"
        resp = requests.get(endpoint, cookies=get_mci_id_cookies())
        if resp.status_code == 200:
            obj = json.loads(resp.text)
            versions = obj['versions']
            return OrderedDict((version['version_id'], version['revision'])
                        for version in versions)

class MCILatestGreenRepository(MCIRepository):
    """Repository to get info form the latest green api call in MCI
    """

    def __init__(self, criteria):
        super(MCILatestGreenRepository, self).__init__(copy.copy(criteria))
        self.criteria.git_hash = self.__get_last_green_git_hash(
            self.criteria.project, self.criteria.variant)

    def __get_last_green_git_hash(self, project, variant):
        endpoint = _MCI_LAST_GREEN_ROOT + project + "?"
        endpoint += variant + "=1"
        resp = requests.get(endpoint, cookies=get_mci_id_cookies())
        if resp.status_code == 200:
            obj = json.loads(resp.text)
            return obj['revision']
        else:
            raise BinariesNotAvailableError(
                "Unable to find latest green build for project %s variant %s"
                % (project, variant))


class MCILatestSuccessfulTasksRepository(MCIRepository):
    """Repository to get info from the last tasks to successfully
    complete in MCI"""

    def __init__(self, criteria):
        super(MCILatestSuccessfulTasksRepository, self).__init__(
            copy.copy(criteria))
        self.criteria.git_hash = self.__get_last_successful_tasks_git_hash(
            self.criteria.project,
            self.criteria.variant,
            self.criteria.tasks)

    def __get_last_successful_tasks_git_hash(self, project, variant, tasks):
        # First need to get a list of version_id's that we can iterate through
        versions = self._get_version_history(project)

        for job_id, version in versions.iteritems():
            endpoint = _MCI_VERSION_STATUS_ROOT + job_id + "/status"
            resp = requests.get(endpoint, cookies=get_mci_id_cookies())
            if resp.status_code == 200:
                obj = json.loads(resp.text)
                # If any tasks are not successful, skip to the next version_id
                for task in tasks:
                    if obj['tasks'][task][variant]['status'] != 'success':
                        break
                else:
                    return version
            else:
                raise BinariesNotAvailableError(
                    "Unable to find latest good build for project %s variant %s"
                    % (project, variant))

        raise BinariesNotAvailableError(
            "Unable to find build which passes tasks (%s) in MCI history "
            "for project %s variant %s" % (
                ", ".join(tasks), project, variant))
