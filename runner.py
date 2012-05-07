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
from pymongo.json_util import object_hook
from optparse import OptionParser

optparser = OptionParser()
optparser.add_option('-p', '--port', dest='port', help='port for mongodb to test', type='string', default='30027')
optparser.add_option('-n', '--iterations', dest='iterations', help='number of iterations to test', type='string', default='100000')
optparser.add_option('-s', '--mongos', dest='mongos', help='send all requests through mongos', action='store_true', default=False)
optparser.add_option('--nolaunch', dest='nolaunch', help='use mongod already running on port', action='store_true', default=False)
optparser.add_option('-m', '--multidb', dest='multidb', help='use a separate db for each connection', action='store_true', default=False)
optparser.add_option('-l', '--label', dest='label', help='name to record', type='string', default='<git version>')

(opts, versions) = optparser.parse_args()
if not versions:
    versions = ['master']

#TODO support multiple versions
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
    benchmark = subprocess.Popen(['./benchmark', opts.port, opts.iterations, multidb], stdout=subprocess.PIPE)
    benchmark_results = benchmark.communicate()[0]
    time.sleep(1) # wait for server to clean up connections
finally:
    if mongod:
        mongod.terminate()
        mongod.wait()

connection = None
try:
    connection = pymongo.Connection()
    results = connection.bench_results.raw
    results.ensure_index('mongodb_git')
    results.ensure_index('name')
    results.remove({'mongodb_git': mongodb_git})
except pymongo.errors.ConnectionFailure:
    pass


for line in benchmark_results.split('\n'):
    if line:
        print line
        obj = json.loads(line, object_hook=object_hook)
        obj['mongodb_version'] = mongodb_version
        obj['mongodb_date'] = mongodb_date
        obj['mongodb_git'] = mongodb_git
        obj['ran_at'] = datetime.datetime.now()
        if connection: results.insert(obj)
        




