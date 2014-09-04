from pyquery import PyQuery as pq
from datetime import datetime
import time
import os
from urllib2 import urlopen, URLError, HTTPError
import pickle
import tempfile
from shutil import move


class BinaryDownloader:
    """ BinaryDownloader class to get latest binaries for MongoDB

    This class is a helper to download the latest binaries for mongodb based on the operating system.
    It currently only gets the x86_64 binaries and will only get the linux/mongodb-linux-x86_64-latest.tgz type files

    """
    def __init__(self, ostype, download_dir):
        """
        Inits the BinaryDownloader with the Operating system type to get the MongoDB binaries for.
        :param ostype: The os type to get,  can be win32, linux, osx, or sunos5
        :param download_dir: the path to place the downloaded binaries tar file as well as store cached checked files
        :return:
        """
        self.download_path = download_dir
        self.ostype = ostype

        # download and last_download is a dict with the following structure
        # { link: <url>, timestamp: <unix timestamp>, path: <path to final tar file>
        self.download = None
        self.last_download = None
        # check file possibly holding the last_download info serialized
        self.checkfile = os.path.join(self.download_path, '.last_download_' + ostype)


    def __download_file(self):
        """
        Private method to actually do the download of the file populated in self.download
        :return: the final path of the downloaded file
        """
        if self.download is None:
            raise Exception('unable to get url from site')
        # Open the url
        try:
            f = urlopen(self.download['link'])
            # Open our local file for writing
            tmpfile = tempfile.mktemp(dir=self.download_path)
            with open(tmpfile, "wb") as local_file:
                local_file.write(f.read())
            final_path = os.path.join(self.download_path, os.path.basename(self.download['link']))
            move(tmpfile, self.download['path'])
            return final_path
        # handle errors
        except HTTPError:
            pass
        except URLError:
            pass


    def __get_latest_remote(self):
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
        d = pq(url='http://www.mongodb.org/dl/' + self.ostype + '/x86_64')
        for tr in d.items('tr'):
            a = tr.find('td').eq(0).find('a')
            if a.attr.href is None:
                continue
            if a.text().rstrip('\n') != self.ostype + "/mongodb-" + self.ostype + "-x86_64-latest.tgz":
                continue
            ts_td = tr.find('td').eq(1)
            dt = time.mktime(datetime.strptime(ts_td.text().rstrip('\n'), '%Y-%m-%d %H:%M:%S').timetuple())
            self.download = {"link": a.attr.href, "timestamp": dt,
                             "path": os.path.join(self.download_path, os.path.basename(a.attr.href))}
            break

    def getLatest(self):
        """
        Gets the latest set of binaries for the OS passed on the init.
        This will either download the load the latest set of binaries from the MongoDB.org website or it will use the
        set of binaries that have already been downloaded.  It stores the information about the last download in a
        checkfile that has the url, timestamp, and path to the last downloaded set of files.

        If there is no checkfile or the checkfile is there but no set of binaries it will refresh downloading the
        current latest set of binaries

        :return:
        """
        # get the checkfile file if its there
        if os.path.isfile(self.checkfile):
            # get the las_download file and unserialize it
            pkl_file = open(self.checkfile, 'rb')
            self.last_download = pickle.load(pkl_file)
            pkl_file.close()
            # see if the file that last_download points to is still there
            if not os.path.isfile(self.last_download['path']):
                self.last_download = None

        self.__get_latest_remote()

        # check to see if the download on the site is newer then the local copy
        if self.last_download is not None and self.download is not None and self.last_download['timestamp'] >= \
                self.download['timestamp']:
            self.download = None

        # do the download if we need to now
        if self.download is not None:
            # download the file
            self.__download_file()
            # write the new download to the checkfile
            output = open(self.checkfile, 'wb+')
            pickle.dump(self.download, output)
            output.close()


