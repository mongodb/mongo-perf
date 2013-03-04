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
from optparse import OptionParser

try:
    from bson.json_util import object_hook
except ImportError:
    from pymongo.json_util import object_hook

optparser = OptionParser()
optparser.add_option('--rhost', dest='rhost', help='remote host for mongodb to write results to', type='string', default='localhost')
optparser.add_option('--rport', dest='rport', help='remote port for mongodb to write results to', type='string', default='30000')
optparser.add_option('-p', '--port', dest='port', help='test port for mongo-perf to run against', type='string', default='30000')
optparser.add_option('-n', '--iterations', dest='iterations', help='number of iterations to test', type='string', default='100000')
optparser.add_option('-s', '--mongos', dest='mongos', help='send all requests through mongos', action='store_true', default=False)
optparser.add_option('--nolaunch', dest='nolaunch', help='use mongod already running on port', action='store_true', default=False)
optparser.add_option('-m', '--multidb', dest='multidb', help='use a separate db for each connection', action='store_true', default=False)
optparser.add_option('-l', '--label', dest='label', help='name to record (useful with nolaunch)', type='string', default='<git version>')
optparser.add_option('-u', '--username', dest='username', help='Username to use for authentication.', type='string', default='')
optparser.add_option('--password', dest='password', help='Password to use for authentication.', type='string', default='')

(opts, versions) = optparser.parse_args()
if not versions:
    versions = ['master']

now = datetime.datetime.now()
benchmark_results=''
try:
    multidb = '1' if opts.multidb else '0'
    benchmark = subprocess.Popen(['./benchmark', opts.port, opts.iterations, multidb, opts.username, opts.password], stdout=subprocess.PIPE)
    benchmark_results = benchmark.communicate()[0]
    time.sleep(1) # wait for server to clean up connections
except:
    pass

connection = None
build_info = None

try:
    connection = pymongo.Connection(host=opts.rhost, port=int(opts.rport))
    results = connection.bench_results.raw
    build_info = connection.bench_results.command('buildinfo')
    results.ensure_index('name')
    results.ensure_index('run_date')
    results.ensure_index('build_info.gitVersion')
    results.ensure_index([('build_info.version', pymongo.ASCENDING), ('run_date', pymongo.ASCENDING), ('name', pymongo.ASCENDING)], unique=True)
except pymongo.errors.ConnectionFailure:
    pass


for line in benchmark_results.split('\n'):
    if line:
        print line
        obj = json.loads(line, object_hook=object_hook)
        obj['build_info'] = build_info
        # TODO get mongodb_date from local mongo git dir
        # subprocess.Popen(['git', 'show', '-s', '--format='%ci'', build_info['gitVersion']], stdout=subprocess.PIPE).communicate()[0]
        obj['run_date'] = now.strftime("%Y-%m-%d")
        if connection: results.update({ 'build_info.version' : build_info['version'], 'run_date' : obj['run_date'], 'name' : obj['name'] }, obj, upsert=True)



