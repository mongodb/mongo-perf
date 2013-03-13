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
branch = versions[0]
mongodb_version = (branch if opts.label=='<git version>' else opts.label)
mongodb_date = None

mongod = None # set in following block
if not opts.nolaunch:
    if not os.path.exists('./tmp/mongo'):
        subprocess.check_call(['git', 'clone', 'http://github.com/mongodb/mongo.git'], cwd='./tmp')
    subprocess.check_call(['git', 'fetch'], cwd='./tmp/mongo')
    subprocess.check_call(['git', 'checkout', branch], cwd='./tmp/mongo')

    if os.path.exists('./tmp/data/'):
        shutil.rmtree('./tmp/data/')
    os.mkdir('./tmp/data/')

    if branch == 'master':
        subprocess.check_call(['git', 'pull'], cwd='./tmp/mongo')

    git_info = subprocess.Popen(['git', 'log', '-1', '--pretty=format:%H %ai'], cwd='./tmp/mongo', stdout=subprocess.PIPE).communicate()[0]
    mongodb_git, mongodb_date = git_info.split(' ', 1)

    subprocess.check_call(['scons', 'mongod'], cwd='./tmp/mongo')

    if opts.mongos:
        mongod = subprocess.Popen(['simple-setup.py', '--path=./tmp/mongo', '--port='+opts.port])#, stdout=open(os.devnull))
        mongodb_version += '-mongos'
        mongodb_git += '-mongos'
    else:
        mongod = subprocess.Popen(['./tmp/mongo/mongod', '--quiet', '--dbpath', './tmp/data/', '--port', opts.port], stdout=open(os.devnull))

    subprocess.check_call(['scons'], cwd='./tmp/mongo')

    mongod = subprocess.Popen(['./tmp/mongo/mongod', '--quiet', '--dbpath', './tmp/data/', '--port', opts.port], stdout=open('/dev/null'))

    print 'pid:', mongod.pid

    time.sleep(10) # wait for server to start up
else:
    mongodb_git="nolaunch"

if opts.label != '<git version>':
    mongodb_git = opts.label

benchmark_results=''
try:
    multidb = '1' if opts.multidb else '0'
    benchmark = subprocess.Popen(['./benchmark', opts.port, opts.iterations, multidb, opts.username, opts.password], stdout=subprocess.PIPE)
    benchmark_results = benchmark.communicate()[0]
    time.sleep(1) # wait for server to clean up connections
finally:
    if mongod:
        mongod.terminate()
        mongod.wait()

connection = None
build_info = None
testbed_info = None
run_date = now.strftime("%Y-%m-%d")
try:
    connection = pymongo.Connection()
    results = connection.bench_results.raw
    analysis = connection.bench_results.info
    build_info = connection.bench_results.command('buildInfo')
    testbed_info = connection.bench_results.command('hostInfo')
    analysis_info = dict({'platform' : testbed_info, 'build_info' : build_info})
    analysis_info['run_date'] = run_date    
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
        if not opts.nolaunch:
            obj['label'] = mongodb_version
            obj['mongod_version'] = mongodb_version
            obj['mongodb_date'] = mongodb_date

        if connection:
            results.update({'label' : obj['label'],
                            'run_date' : obj['run_date'],
                            'version' : obj['version'],
                            'platform' : obj['platform'],
                            'name' : obj['name']
                            }, obj, upsert=True)


