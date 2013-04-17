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

"""Inserts simulated data into the database"""

import sys
import subprocess
import os
import shutil
import time
import pymongo
import json
import pprint
import datetime
from mongomgr import mongod
from optparse import OptionParser
from collections import defaultdict

try:
    from bson.json_util import object_hook
except ImportError:
    from pymongo.json_util import object_hook


def populate(time, label, platform, version):
    singledb_benchmark_results, multidb_benchmark_results = '', ''
    try:
        print 'running single db tests...'
        single_benchmark = subprocess.Popen(
            ['./benchmark', "27017",
             '1', '0', '', ''],
            stdout=subprocess.PIPE)
        single_benchmark_results = single_benchmark.communicate()[0]
        print 'running multi db tests...'
        multi_benchmark = subprocess.Popen(
            ['./benchmark', "27017",
             '1', '1', '', ''],
            stdout=subprocess.PIPE)
        multi_benchmark_results = multi_benchmark.communicate()[0]
    except:
        pass

    connection = None
    build_info = None
    testbed_info = None
    run_date = time.strftime("%Y-%m-%d")

    try:
        connection = pymongo.Connection()
        raw = connection.bench_results.raw
        host = connection.bench_results.host
        build_info = connection.bench_results.command('buildInfo')
        host_info = connection.bench_results.command('hostInfo')
        info = dict({'platform': host_info,
                     'build_info': build_info})
        info['run_date'] = run_date
        info['label'] = label
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
                     'label': label, 'run_date': run_date
                     }, info, upsert=True)

    except pymongo.errors.ConnectionFailure:
        print 'failed to connect to mongo'
        pass

    single_benchmarks, multi_benchmarks = [], []

    for line in single_benchmark_results.split('\n'):
        if line:
            obj = json.loads(line, object_hook=object_hook)
            single_benchmarks.append(obj)

    for line in multi_benchmark_results.split('\n'):
        if line:
            obj = json.loads(line, object_hook=object_hook)
            multi_benchmarks.append(obj)

    if connection:
        obj = defaultdict(dict)
        obj['label'] = label
        obj['run_date'] = run_date
        obj['singledb'] = single_benchmarks
        obj['multidb'] = multi_benchmarks
        obj['version'] = version
        obj['commit'] = build_info['gitVersion']
        obj['platform'] = platform
        raw.update({'label': obj['label'],
                    'run_date': obj['run_date'],
                    'version': obj['version'],
                    'platform': obj['platform']
                    }, obj, upsert=True)


if __name__ == "__main__":
    for time in xrange(-2, 2):
        for label in [
            "Linux 64-bit", "Linux 64-bit DUR OFF", "OS X 64-bit DUR OFF",
                "OS X 64-bit", "Windows 64-bit", "Windows 64-bit 2008"]:
            for version in ["2.4.1", "2.4.0-rc0", "2.2.3"]:
                now = datetime.datetime.now() + datetime.timedelta(days=time)
                platform = label[0:label.index("6")-1].replace(" ", "_")
                label = label.replace(" ", "_")
                print 'creating data for %s - %s - %s - %s' % (now, label, platform, version)
                populate(now, label, platform, version)
            print 'done creating data!'

