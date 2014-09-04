from pyquery import PyQuery as pq
from datetime import datetime
import time
import os
from urllib2 import urlopen, URLError, HTTPError
import pickle
import tempfile
from shutil import move


class BinaryDownloader:

    # ostype can be win32, linux, osx
    def __init__(self, ostype):
        self.builddir = os.environ.get('BUILD_DIR', os.path.dirname(os.path.realpath(__file__)))
        self.ostype = ostype

        # download and last_download is a dict with the following structure
        # { link: <url>, timestamp: <unix timestamp>, path: <path to final tar file>
        self.download = None
        self.last_download = None
        # check file possibly holding the last_download info serialized
        self.checkfile = os.path.join(self.builddir, '.last_download_' + ostype)


    def __download_file(self):
        if self.download is None:
            raise Exception('unable to get url from site')
        # Open the url
        try:
            f = urlopen(self.download['link'])
            # Open our local file for writing
            tmpfile = tempfile.mktemp(dir=self.builddir)
            with open(tmpfile, "wb") as local_file:
                local_file.write(f.read())
            final_path = os.path.join(self.builddir, os.path.basename(self.download['link']))
            move(tmpfile, self.download['path'])
            return final_path
        # handle errors
        except HTTPError:
            pass
        except URLError:
            pass


    # get the html for the downloads page and parse for the download link and the timestamp
    # based on the pages structure of
    # <tr>
    # <td><a href="http://downloads.mongodb.org/osx/mongodb-osx-x86_64-v2.4-latest.tgz">osx/mongodb-osx-x86_64-v2.4-latest.tgz</a></td>
    # <td>2014-09-03 10:18:19</td>
    # <td>87899836</td>
    # <td><a href="http://downloads.mongodb.org/osx/mongodb-osx-x86_64-v2.4-latest.tgz.md5">md5</a></td>
    # <td></td>
    # <td></td>
    # <td></td>
    # </tr>
    def __get_latest_remote(self):
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
                             "path": os.path.join(self.builddir, os.path.basename(a.attr.href))}
            break

    def getLatest(self):

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


