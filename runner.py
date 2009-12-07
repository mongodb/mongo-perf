#!/usr/bin/python2

import sys
import subprocess
import os
import shutil
import time

if not os.path.exists('./tmp/mongo'):
    subprocess.check_call(['git', 'clone', 'http://github.com/mongodb/mongo.git'], cwd='./tmp')

if os.path.exists('./tmp/data/'):
    shutil.rmtree('./tmp/data/')
os.mkdir('./tmp/data/'

branch = sys.argv[1] if (len(sys.argv) > 1) else 'master'
subprocess.check_call(['git', 'checkout', branch], cwd='./tmp/mongo')

if branch == 'master':
    subprocess.check_call(['git', 'pull'], cwd='./tmp/mongo')

subprocess.check_call(['scons'], cwd='./tmp/mongo')

mongod = subprocess.Popen(['./tmp/mongo/mongod', '--dbpath', './tmp/data/', '--port', '30027'])

time.sleep(1) # wait for server to come up

benchmark_results=''
try:
    benchmark = subprocess.Popen(['./benchmark'], stdout=subprocess.PIPE)
    benchmark_results = benchmark.stdout.read()
    benchmark.wait()
finally:
    mongod.terminate()
    mongod.wait()

print benchmark_results




