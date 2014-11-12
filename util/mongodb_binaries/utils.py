import os
import shutil
import tarfile
import tempfile
import zipfile

from os import listdir
from urllib2 import urlopen


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
        try:
            extract_dir = tempfile.mkdtemp()
            archive_binaries_dir = self.__create_extraction_dir(
                zip_file.namelist(), extract_dir, zip_file.extract)
        finally:
            zip_file.close()
        return archive_binaries_dir, extract_dir

    def __extract_tgz(self):
        """
        Extracts the binaries form a compressed tar archive
        :return: a tuple with the path to the extracted archives bin dir
        and a path to the top level dir where it was extracted to
        """
        tar_file = tarfile.open(self.archive)
        try:
            extract_dir = tempfile.mkdtemp()
            archive_binaries_dir = self.__create_extraction_dir(
                tar_file.getnames(), extract_dir, tar_file.extract)
        finally:
            tar_file.close()
        return archive_binaries_dir, extract_dir


    def __create_extraction_dir(self, names_list, extraction_dir,
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

