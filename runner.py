#!/usr/bin/python

import sys
import subprocess
import os
import shutil
import time
import pymongo
import json
import pprint
import datetime
from smoke import mongod
from optparse import OptionParser

try:
    from bson.json_util import object_hook
except ImportError:
    from pymongo.json_util import object_hook

optparser = OptionParser()
optparser.add_option('--rhost', dest='rhost', help='host for mongodb to write results to', type='string', default='localhost')
optparser.add_option('--rport', dest='rport', help='port for mongodb to write results to', type='string', default='30000')
optparser.add_option('--mongod', dest='mongod', help='path to mongod executable', type='string', default='.')
optparser.add_option('-p', '--port', dest='port', help='test port for mongo-perf to run against', type='string', default='30000')
optparser.add_option('-n', '--iterations', dest='iterations', help='number of iterations to test', type='string', default='100000')
optparser.add_option('-s', '--mongos', dest='mongos', help='send all requests through mongos', action='store_true', default=False)
optparser.add_option('--nolaunch', dest='nolaunch', help='use mongod already running on port', action='store_true', default=False)
optparser.add_option('-m', '--multidb', dest='multidb', help='use a separate db for each connection', action='store_true', default=False)
optparser.add_option('-l', '--label', dest='label', help='performance testing host', type='string', default='')
optparser.add_option('-u', '--username', dest='username', help='Username to use for authentication.', type='string', default='')
optparser.add_option('--password', dest='password', help='Password to use for authentication.', type='string', default='')

(opts, versions) = optparser.parse_args()
if not versions:
    versions = ['master']

now = datetime.datetime.now()
benchmark_results=''
mongod_handle=None

try:
    multidb = '1' if opts.multidb else '0'
    # start mongod
    mongod_handle = mongod(mongod=opts.mongod, port=opts.port)
    mongod_handle.start()
    benchmark = subprocess.Popen(['./benchmark', opts.port, opts.iterations, multidb, opts.username, opts.password], stdout=subprocess.PIPE)
    benchmark_results = benchmark.communicate()[0]
    time.sleep(1) # wait for server to clean up connections
except:
    pass

connection = None
build_info = None
testbed_info = None
run_date = now.strftime("%Y-%m-%d")

try:
    connection = pymongo.Connection(host=opts.rhost, port=int(opts.rport))
    results = connection.bench_results.raw
    analysis = connection.bench_results.info
    build_info = connection.bench_results.command('buildInfo')
    testbed_info = connection.bench_results.command('hostInfo')
    analysis_info = dict({'platform' : testbed_info, 'build_info' : build_info})
    analysis_info['run_date'] = run_date    
    # 'builder' will be used to hold builder info
    analysis_info['label'] = opts.label
    results.ensure_index('name')
    results.ensure_index('label')
    results.ensure_index('run_date')
    results.ensure_index('version')
    results.ensure_index([('version', pymongo.ASCENDING)
                        , ('run_date', pymongo.ASCENDING)
                        , ('label', pymongo.ASCENDING)
                        , ('name', pymongo.ASCENDING)]
                        , unique=True)

    analysis.ensure_index([('build_info.version', pymongo.ASCENDING)
                        , ('label', pymongo.ASCENDING)
                        , ('run_date', pymongo.ASCENDING)]
                        , unique=True)
   
    analysis.update({   'build_info.version' : build_info['version'],
                        'label' : opts.label,
                        'run_date' : run_date
                    } , analysis_info, upsert=True)

except pymongo.errors.ConnectionFailure:
    pass

for line in benchmark_results.split('\n'):
    if line:
        print line
        obj = json.loads(line, object_hook=object_hook)
        obj['run_date'] = run_date
        obj['label'] = opts.label
        obj['platform'] = testbed_info['os']['name']
        obj['commit'] = build_info['gitVersion']
        obj['version'] = build_info['version']
        obj['run_date'] = run_date
        if connection:
            results.update({'label' : obj['label'],
                            'run_date' : obj['run_date'],
                            'version' : obj['version'],
                            'platform' : obj['platform'],
                            'name' : obj['name']
                            }, obj, upsert=True)

mongod_handle.stop()