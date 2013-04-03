#!/usr/bin/env python

import sys
import subprocess
import os
import shutil
import time
import pymongo
import json
import pprint
import datetime
import mongomgr
from optparse import OptionParser
from collections import defaultdict

try:
    from bson.json_util import object_hook
except ImportError:
    from pymongo.json_util import object_hook

# Globals
processes = []
connection = None
mongod_handle = None
now = datetime.datetime.now()
run_date = now.strftime("%Y-%m-%d")

def cleanup():
    global processes
    retval = 0
    for p in processes:
        terminated = p.poll()
        if terminated == None:
            p.kill()
            retval = 1
    return retval

def parse_options():
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

def run_benchmark(opts):
    global mongod_handle, processes

    benchmark_results = ''
    try:
        multidb = '1' if opts.multidb else '0'
        exe = '.exe' if os.sys.platform.startswith( "win" ) else ''
        mongod_path = opts.mongod + exe
        mongod_handle = mongomgr.mongod(mongod=mongod_path, 
                                        port=opts.port)
        mongod_handle.__enter__()
        processes.append(mongod_handle.proc)
    except:
        print >> sys.stderr, "Could not start mongod", sys.exc_info()[0]
        retval = cleanup()
        sys.exit(retval)

    try:
        benchmark = subprocess.Popen(
                            ['./benchmark', opts.port, opts.iterations, \
                            multidb, opts.username, opts.password], \
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print >> sys.stderr, "running benchmark tests..."
        benchmark_results = benchmark.communicate()[0]
        time.sleep(1) # wait for server to clean up connections
    except:
        print >> sys.stderr, "Could not start complete " \
                        "benchmark tests", sys.exc_info()[0]
        retval = cleanup()
        sys.exit(retval)
    return benchmark_results

def prep_storage(opts):
    global connection

    build_info, host_info = None, None

    try:
        connection = pymongo.Connection(host=opts.rhost, 
                                        port=int(opts.rport))
        raw = connection.bench_results.raw
        host = connection.bench_results.host
        build_info = connection.bench_results.command('buildInfo')
        host_info = connection.bench_results.command('hostInfo')
        info = dict({ 'platform' : host_info, \
                      'build_info' : build_info})
        info['run_date'] = run_date    
        info['label'] = opts.label
        raw.ensure_index('label')
        raw.ensure_index('run_date')
        raw.ensure_index('version')
        raw.ensure_index('platform')
        raw.ensure_index([('version', pymongo.ASCENDING)
                            , ('label', pymongo.ASCENDING)
                            , ('platform', pymongo.ASCENDING)
                            , ('run_date', pymongo.ASCENDING)]
                            , unique=True)

        host.ensure_index([('build_info.version', pymongo.ASCENDING)
                            , ('label', pymongo.ASCENDING)
                            , ('run_date', pymongo.ASCENDING)]
                            , unique=True)
       
        host.update({ 'build_info.version' : build_info['version'],
                      'label' : opts.label,
                      'run_date' : run_date
                    } , info, upsert=True)

    except pymongo.errors.ConnectionFailure, e:
        print >> sys.stderr, \
        "Could not connect to MongoDB database", sys.exc_info()[0]
        retval = cleanup()
        sys.exit(retval)
    except:
        print >> sys.stderr, \
        "Unexpected error in getting host/build info", sys.exc_info()[0]
        retval = cleanup()
        sys.exit(retval)

    return build_info, host_info

def store_results(opts, benchmark_results):
    global connection, mongod_handle

    build_info, host_info = prep_storage(opts)
    try:
        raw = connection.bench_results.raw
        benchmarks = []
        for line in benchmark_results.split('\n'):
            if line:
                obj = json.loads(line, object_hook=object_hook)
                benchmarks.append(obj)
        if connection:
            for benchmark in benchmarks:
                print benchmark
            obj = defaultdict(dict)
            obj['label'] = opts.label
            obj['run_date'] = run_date
            obj['benchmarks'] = benchmarks
            obj['version'] = build_info['version']
            obj['commit'] = build_info['gitVersion']
            obj['platform'] = host_info['os']['name'].replace(" ","_")
            update_collection(raw, obj)
    except:
        print >> sys.stderr, "Unexpected dict error", sys.exc_info()
        retval = cleanup()
        sys.exit(retval)
    finally:
        if not opts.nolaunch:
            mongod_handle.__exit__(None, None, None)

def update_collection(collection, obj):
    try:
        collection.update({ 'label' : obj['label'],
                            'version' : obj['version'],
                            'platform' : obj['platform'],
                            'run_date' : obj['run_date']
                            }, obj, upsert=True)
    except:
        print >> sys.stderr, "Could not update %s" % collection, \
                sys.exc_info()[0]
        retval = cleanup()
        sys.exit(retval)

def main():
    opts, versions = parse_options()
    benchmark_results = run_benchmark(opts)
    store_results(opts, benchmark_results)

if __name__ == '__main__':
    main()

