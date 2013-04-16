# Copyright 2013 10gen, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Buildbot script to run benchmark tests"""

import os
import sys
import time
import json
import pprint
import shutil
import pymongo
import datetime
import mongomgr
import subprocess
import logging
import logging.handlers
from optparse import OptionParser
from collections import defaultdict

try:
    from bson.json_util import object_hook
except ImportError:
    from pymongo.json_util import object_hook

# Set up logging
LOG_FILE = "mongo-perf-log.txt"

class Master(object):
    """Class encapsulating methods for performing
        benchmark tests 
    """
    def __init__(self, *args, **kwargs):
        """ Get a definition given parameters.
        """
        self.opts = args[0]
        self.connection = None
        self.now = datetime.datetime.utcnow()
        self.logger = logging.getLogger(LOG_FILE)
        self.configureLogger(LOG_FILE)
        self.run_date = self.now.strftime("%Y-%m-%d")

    def cleanup(self):
        """Cleans up spawned children
        """
        retval = 0
        for p in self.processes:
            terminated = p.poll()
            if terminated is None:
                p.kill()
                retval = 1
        return retval

    def configureLogger(self, logFile):
        """Configures logger to send messages to stdout and logFile
        """
        logFile = os.path.abspath(logFile)
        logHdlr = logging.handlers.RotatingFileHandler(logFile,
                    maxBytes=(100 * 1024 ** 2), backupCount=1)
        stdoutHdlr = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
        logHdlr.setFormatter(formatter)
        stdoutHdlr.setFormatter(formatter)
        self.logger.addHandler(logHdlr)
        self.logger.addHandler(stdoutHdlr)
        self.logger.setLevel(logging.INFO)

    def prep_storage(self):
        """Gets host/build info and creates indexes
            in the varius collections
        """
        build_info, host_info = None, None

        if not self.opts.label:
            self.opts.label = 'test'

        try:
            self.logger.info("Prepping for storage...")
            self.connection = pymongo.MongoClient(host=self.opts.rhost,
                                             port=int(self.opts.rport))
            raw = self.connection.bench_results.raw
            host = self.connection.bench_results.host
            build_info = self.connection.bench_results.command('buildInfo')
            host_info = self.connection.bench_results.command('hostInfo')
            info = dict({'platform': host_info,
                         'build_info': build_info})
            info['run_date'] = self.run_date
            info['label'] = self.opts.label

            raw.ensure_index('label')
            raw.ensure_index('run_date')
            raw.ensure_index('version')
            raw.ensure_index('platform')
            raw.ensure_index(
                [('version', pymongo.ASCENDING),
                 ('label', pymongo.ASCENDING),
                 ('platform', pymongo.ASCENDING),
                 ('run_date', pymongo.ASCENDING)],
                unique=True)

            host.ensure_index(
                [('build_info.version', pymongo.ASCENDING),
                 ('label', pymongo.ASCENDING),
                 ('run_date', pymongo.ASCENDING)],
                unique=True)

            host.update({'build_info.version': build_info['version'],
                         'label': self.opts.label,
                         'run_date': self.run_date
                         }, info, upsert=True)

        except pymongo.errors.ConnectionFailure, e:
            self.logger.error("Could not connect to MongoDB database - {0}".
                                format(e))
            retval = self.cleanup()
            sys.exit(retval)

        except pymongo.errors.OperationFailure, e:
            self.logger.error("Unexpected error in getting host/build info - {0}"
                                .format(e))
            retval = self.cleanup()
            sys.exit(retval)

        except ValueError, e:
            self.logger.error("rport must be an instance of int - {0}".
                                format(e))
            retval = self.cleanup()
            sys.exit(retval)

        return build_info, host_info


    def store_results(self, benchmark_results):
        """Inserts the benchmarked object into the database
        """
        build_info, host_info = self.prep_storage()

        self.logger.info("Storing test results...")
        raw = self.connection.bench_results.raw
        benchmarks = []
        for line in benchmark_results.split('\n'):
            if line:
                obj = json.loads(line, object_hook=object_hook)
                benchmarks.append(obj)

        for benchmark in benchmarks:
            self.logger.info(benchmark)

        obj = defaultdict(dict)
        obj['label'] = self.opts.label
        obj['run_date'] = self.run_date
        obj['benchmarks'] = benchmarks
        obj['version'] = build_info['version']
        obj['commit'] = build_info['gitVersion']
        obj['platform'] = host_info['os']['name'].replace(" ", "_")
        self.update_collection(raw, obj)

        if not self.opts.local:
            self.mongod_handle.__exit__(None, None, None)


    def update_collection(self, collection, obj):
        """Helper to insert the benchmarked object into the database
        """
        try:
            collection.update({'label': obj['label'],
                               'version': obj['version'],
                               'platform': obj['platform'],
                               'run_date': obj['run_date']
                               }, obj, upsert=True)

        except pymongo.errors.OperationFailure, e:
            self.logger.error("Could not update {0}".format(collection))
            retval = self.cleanup()
            sys.exit(retval)


class Local(Master):
    """To be run on local machine
    """

    def __init__(self, *args, **kwargs):
        super(Local, self).__init__(*args, **kwargs)

    def run_benchmark(self):
        """Runs the benchmark tests; pulls mongod
            from github if requested
        """
        mongod = None

        if not self.opts.nolaunch:
            if not os.path.exists('./tmp/mongo'):
                subprocess.check_call(['git', 'clone',
                                       'http://github.com/mongodb/mongo.git'], 
                                       cwd='./tmp')
            subprocess.check_call(['git', 'fetch'], cwd='./tmp/mongo')
            subprocess.check_call(['git', 'checkout', branch], cwd='./tmp/mongo')

            if os.path.exists('./tmp/data/'):
                shutil.rmtree('./tmp/data/')
            os.mkdir('./tmp/data/')

            if branch == 'master':
                subprocess.check_call(['git', 'pull'], cwd='./tmp/mongo')

            git_info = subprocess.Popen(['git', 'log', '-1',
                                         '--pretty=format:%H %ai'], cwd='./tmp/mongo',
                                         stdout=subprocess.PIPE).communicate()[0]

            mongodb_git, mongodb_date = git_info.split(' ', 1)

            subprocess.check_call(['scons', 'mongod'], cwd='./tmp/mongo')

            if self.opts.mongos:
                mongod = subprocess.Popen(['simple-setup.py',
                                            '--path=./tmp/mongo',
                                            '--port='+self.opts.port])
                #, stdout=open(os.devnull))
                mongodb_version += '-mongos'
                mongodb_git += '-mongos'
            else:
                mongod = subprocess.Popen(['./tmp/mongo/mongod',
                                           '--quiet', '--dbpath', './tmp/data/',
                                           '--port', self.opts.port], 
                                           stdout=open(os.devnull))

            subprocess.check_call(['scons'], cwd='./tmp/mongo')

            mongod = subprocess.Popen(['./tmp/mongo/mongod',
                                       '--quiet', '--dbpath', './tmp/data/',
                                       '--port', self.opts.port], 
                                       stdout=open('/dev/null'))

            self.logger.info("pid: {0}".format(mongod.pid))

            time.sleep(1)  # wait for server to start up
        else:
            mongodb_git = "nolaunch"

        if self.opts.label != '<git version>':
            mongodb_git = self.opts.label

        benchmark_results = ''
        try:
            multidb = '1' if self.opts.multidb else '0'
            benchmark = subprocess.Popen(['./benchmark', self.opts.port,
                                          self.opts.iterations, 
                                          multidb, self.opts.username,
                                          self.opts.password], 
                                          stdout=subprocess.PIPE)
            self.logger.info("Started with args: {0}".format(opts))
            benchmark_results = benchmark.communicate()[0]
            time.sleep(1)  # wait for server to clean up connections
        except OSError, e:
            self.logger.error("Could not start benchmark tests - {0}".
                                    format(e))
            retval = self.cleanup()
            sys.exit(retval)
        except ValueError, e:
            self.logger.error("Invalid arguments supplied! - {0}".
                                format(e))
            retval = self.cleanup()
            sys.exit(retval)

        finally:
            if mongod:
                mongod.terminate()
                mongod.wait()
        return benchmark_results


class Runner(Master):
    """To be run on buildslave
    """

    def __init__(self, *args, **kwargs):
        super(Runner, self).__init__(*args, **kwargs)
        self.processes = []
        self.mongod_handle = None

    def run_benchmark(self):
        """Runs the benchmark tests
        """
        benchmark_results = ''
        try:
            multidb = '1' if self.opts.multidb else '0'
            exe = '.exe' if os.sys.platform.startswith("win") else ''
            mongod_path = self.opts.mongod + exe
            self.mongod_handle = mongomgr.mongod(mongod=mongod_path,
                                                port=self.opts.port,
                                                logger=self.logger)
            self.mongod_handle.__enter__()
            self.processes.append(self.mongod_handle.proc)
        except OSError, e:
            self.logger.error("Could not start mongod - {0}".
                                    format(e))
            retval = self.cleanup()
            sys.exit(retval)

        try:
            benchmark = subprocess.Popen(
                ['./benchmark', self.opts.port, self.opts.iterations,
                 multidb, self.opts.username, self.opts.password],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.logger.info("Running benchmark tests...")
            benchmark_results = benchmark.communicate()[0]
            time.sleep(1)  # wait for server to clean up connections
        except OSError, e:
            self.logger.error("Could not start/complete " \
                    "benchmark tests - {0}".format(e))
            retval = self.cleanup()
            sys.exit(retval)
        except ValueError, e:
            self.logger.error("Invalid arguments supplied! - {0}".
                                format(e))
            retval = self.cleanup()
            sys.exit(retval)

        return benchmark_results


def main():
    opts, versions = parse_options()
    handle = None
    if opts.local:
        handle = Local(opts)
    else:
        handle = Runner(opts)
    # run benchmark tests
    benchmark_results = handle.run_benchmark()
    # store benchmark tests
    handle.store_results(benchmark_results)


def parse_options():
    """Parses user supplied cl options
    """
    optparser = OptionParser()
    optparser.add_option('--rhost', dest='rhost',
                         help='host for mongodb to write results to',
                         type='string', default='localhost')
    optparser.add_option('--rport', dest='rport',
                         help='port for mongodb to write results to',
                         type='string', default='30000')
    optparser.add_option('--mongod', dest='mongod',
                         help='path to mongod executable',
                         type='string', default='mongod')
    optparser.add_option('-p', '--port', dest='port',
                         help='test port for mongo-perf to run against',
                         type='string', default='30000')
    optparser.add_option('-n', '--iterations', dest='iterations',
                         help='number of iterations to test',
                         type='string', default='100000')
    optparser.add_option('-s', '--mongos', dest='mongos',
                         help='send all requests through mongos',
                         action='store_true', default=False)
    optparser.add_option('--nolaunch', dest='nolaunch',
                         help='use mongod already running on port',
                         action='store_true', default=False)
    optparser.add_option('--local', dest='local',
                         help='run on local machine',
                         action='store_true', default=False)
    optparser.add_option('-m', '--multidb', dest='multidb',
                         help='use a separate db for each connection',
                         action='store_true', default=False)
    optparser.add_option('-l', '--label', dest='label',
                         help='performance testing host',
                         type='string', default='')
    optparser.add_option('-u', '--username', dest='username',
                         help='Username to use for authentication.',
                         type='string', default='')
    optparser.add_option('--password', dest='password',
                         help='Password to use for authentication.',
                         type='string', default='')
    return optparser.parse_args()

if __name__ == '__main__':
    main()
