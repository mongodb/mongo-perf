#!/usr/bin/python2

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

(opts, versions) = optparser.parse_args()
if not versions:
    versions = ['master']


if not os.path.exists('./tmp/mongo'):
    subprocess.check_call(['git', 'clone', 'http://github.com/mongodb/mongo.git'], cwd='./tmp')

if os.path.exists('./tmp/data/'):
    shutil.rmtree('./tmp/data/')
os.mkdir('./tmp/data/')

#TODO support multiple versions
branch = versions[0]
subprocess.check_call(['git', 'checkout', branch], cwd='./tmp/mongo')

if branch == 'master':
    subprocess.check_call(['git', 'pull'], cwd='./tmp/mongo')

git_info = subprocess.Popen(['git', 'log', '-1', '--date=iso'], cwd='./tmp/mongo', stdout=subprocess.PIPE).communicate()[0]
git_info = git_info.split('\n')
mongodb_git = git_info[0].split()[1]
mongodb_date = git_info[2].split(':',1)[1].strip()

subprocess.check_call(['scons'], cwd='./tmp/mongo')

mongod = subprocess.Popen(['./tmp/mongo/mongod', '--dbpath', './tmp/data/', '--port', opts.port])

time.sleep(1) # wait for server to start up

benchmark_results=''
try:
    benchmark = subprocess.Popen(['./benchmark', opts.port, opts.iterations], stdout=subprocess.PIPE)
    benchmark_results = benchmark.communicate()[0]
    time.sleep(1) # wait for server to clean up connections
finally:
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
        obj['mongodb_version'] = branch
        obj['mongodb_date'] = mongodb_date
        obj['mongodb_git'] = mongodb_git
        obj['ran_at'] = datetime.datetime.now()
        if connection: results.insert(obj)
        




