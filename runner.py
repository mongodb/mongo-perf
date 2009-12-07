#!/usr/bin/python2

import sys
import subprocess
import os
import shutil
import time
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

subprocess.check_call(['scons'], cwd='./tmp/mongo')

mongod = subprocess.Popen(['./tmp/mongo/mongod', '--dbpath', './tmp/data/', '--port', opts.port])

time.sleep(1) # wait for server to start up

benchmark_results=''
try:
    benchmark = subprocess.Popen(['./benchmark', opts.port, opts.iterations], stdout=subprocess.PIPE)
    benchmark_results = benchmark.stdout.read()
    benchmark.wait()
    time.sleep(1) # wait for server to clean up connections
finally:
    mongod.terminate()
    mongod.wait()

print benchmark_results




