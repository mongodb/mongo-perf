#!/usr/bin/env python
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

"""Web app for mongo-perf"""

import argparse
import bson
import json
import pymongo
import time

from bottle import *
from collections import defaultdict
from ConfigParser import SafeConfigParser


DEFAULT_OPTIONS = {
    'database_hostname': 'localhost',
    'database_port': 27017,
    'database_replica_set': 'none',
    'database_name': 'bench_results',
    'server_port': 8080,
    'server_bindip': '0.0.0.0'
}
DEFAULT_STORAGE_ENGINE = 'mmapv0'
DEFAULT_TOPOLOGY = 'single_node'
CONFIG_INI_FILE_PRODUCTION = 'mongo-perf-prod.ini'
CONFIG_INI_FILE_DEVELOPMENT = 'mongo-perf-devel.ini'
RUN_MODE_PRODUCTION = 'prod'
RUN_MODE_DEVELOPMENT = 'devel'

# setup command line arguments
argument_parser = argparse.ArgumentParser(
    description='The mongo-perf web server.')
argument_parser.add_argument('--mode', dest='mode', action='store',
                             default='prod', choices=[RUN_MODE_PRODUCTION,
                                                      RUN_MODE_DEVELOPMENT],
                             help='The mode to run the mongo-perf server in')
args = argument_parser.parse_args()

config = SafeConfigParser(defaults=DEFAULT_OPTIONS)
if args.mode == 'prod':
    config_files = [CONFIG_INI_FILE_PRODUCTION]
else:
    config_files = [CONFIG_INI_FILE_DEVELOPMENT]
config.read(config_files)
if not config.has_section("mongo-perf"):
    config.add_section("mongo-perf")

# performance metrics are stored in mongod
# database info
DATABASE_REPLICA_SET = config.get(section='mongo-perf',
                                  option='database_replica_set')
DATABASE_HOST = config.get(section='mongo-perf', option='database_hostname')
DATABASE_PORT = config.get(section='mongo-perf', option='database_port',
                           raw=True)
DATABASE_NAME = config.get(section='mongo-perf', option='database_name')

# web server settings
SERVER_BIND_IP = config.get(section='mongo-perf', option='server_bindip')
SERVER_PORT = config.get(section='mongo-perf', option='server_port', raw=True)

# connect to our standalone, or replica set database
if DATABASE_REPLICA_SET == 'none':
    db = pymongo.Connection(host=DATABASE_HOST, port=DATABASE_PORT)[
        DATABASE_NAME]
else:
    db = pymongo.Connection(host=DATABASE_HOST, port=DATABASE_PORT,
                            replicaSet=DATABASE_REPLICA_SET)[DATABASE_NAME]


global filter_cache
filter_cache = {}
filter_cache_timeout = 300

# make sure the indexes needed for the gui are created

# primary main page index
db.raw.ensure_index([('commit_date', pymongo.ASCENDING),
                     ('platform', pymongo.ASCENDING),
                     ('label', pymongo.ASCENDING),
                     ('server_storage_engine', pymongo.ASCENDING)])
# # main page filters
db.raw.ensure_index([('commit_date', pymongo.ASCENDING)])
db.raw.ensure_index([('server_storage_engine', pymongo.ASCENDING)])
db.raw.ensure_index([('label', pymongo.ASCENDING)], unique=True)
db.raw.ensure_index([('platform', pymongo.ASCENDING)])
db.raw.ensure_index([('version', pymongo.ASCENDING)])
db.raw.ensure_index([('singledb.name', pymongo.ASCENDING)])
db.raw.ensure_index([('multidb.name', pymongo.ASCENDING)])
db.raw.ensure_index([('run_date', pymongo.ASCENDING)])
db.raw.ensure_index([('run_time', pymongo.ASCENDING)])



@route('/static/:filename#.*#')
def send_static(filename):
    return static_file(filename, root='./static')


def gen_query(labels, dates, versions, start, end, limit, ids, commits,
              engines):
    if start:
        start_query = {'commit_date': {'$gte': start}}
    else:
        start_query = {}

    if end:
        end_query = {'commit_date': {'$lte': end}}
    else:
        end_query = {}

    if limit:
        try:
            limit = int(limit)
        except ValueError:
            limit = None

    if dates:
        if dates.startswith('/') and dates.endswith('/'):
            date_query = {'run_date': {'$regex':
                                           dates[1:-1], '$options': 'i'}}
        else:
            date_query = {'run_date': {'$in': dates}}
    else:
        date_query = {}

    if labels:
        if labels.startswith('/') and labels.endswith('/'):
            label_query = {'label': {'$regex':
                                         labels[1:-1], '$options': 'i'}}
        else:
            label_query = {'label': {'$in': labels}}
    else:
        label_query = {}

    if versions:
        if versions.startswith('/') and versions.endswith('/'):
            version_query = {'version': {'$regex':
                                             versions[1:-1], '$options': 'i'}}
        else:
            version_query = {'version': {'$in': versions}}
    else:
        version_query = {}

    if engines:
        if engines.startswith('/') and engines.endswith('/'):
            engines_query = {'server_storage_engine': {'$regex':
                                                           engines[1:-1],
                                                       '$options': 'i'}}
        else:
            engines_query = {'server_storage_engine': {'$in': engines}}
    else:
        engines_query = {}

    if ids:
        objids = []
        for id in ids:
            objids.append(bson.objectid.ObjectId(id));
        id_query = {'_id': {'$in': objids}}
    else:
        id_query = {}

    if commits:
        if commits.startswith('/') and commits.endswith('/'):
            commit_query = {'commit': {'$regex': commits[1:-1]}}
    else:
        commit_query = {}

    query = {
        "$and": [label_query, date_query, version_query, start_query, end_query,
                 id_query, commit_query, engines_query]}
    cursor = db.raw.find(query).sort([('commit_date', pymongo.ASCENDING),
                                      ('platform', pymongo.ASCENDING),
                                      ('label', pymongo.ASCENDING),
                                      ('server_storage_engine',
                                       pymongo.ASCENDING)])

    if limit:
        cursor.limit(limit)

    return cursor


def process_cursor(cursor, multidb):
    aggregate = defaultdict(list)
    result_size = cursor.count(with_limit_and_skip=True)

    for index in xrange(0, result_size):
        entry = cursor[index]
        for mdb in multidb.split(' '):
            mdbstr = 'singledb' if mdb == '0' else 'multidb'
            if mdbstr in entry:
                results = entry[mdbstr]

                for result in results:
                    row = dict(commit=entry['commit'],
                               platform=entry['platform'],
                               version=entry['version'],
                               label=entry['label'],
                               server_storage_engine=entry[
                                   'server_storage_engine']
                               )

                    row['topology'] = (entry['topology']
                                       if 'topology' in entry.keys()
                                       else DEFAULT_TOPOLOGY)

                    if 'commit_date' in entry.keys():
                        row['date'] = entry['commit_date'].strftime(
                            "%b %d %I:%M%p")
                    else:
                        # legacy data before we had commit_date in the schema
                        row['date'] = 'legacy'

                    for (n, res) in result['results'].iteritems():
                        row[n] = res
                    aggregate[result['name']].append(row)

    aggregate = sorted(aggregate.iteritems(), key=lambda (k, v): k)
    out = []

    for item in aggregate:
        out.append({'name': item[0], 'results': item[1]})

    return out


def raw_data(labels, multidb, dates, start, end, limit, ids, commits, engines):
    cursor = gen_query(labels, dates, None, start, end, limit, ids, commits,
                       engines)
    result = process_cursor(cursor, multidb)
    return result


def getDefaultIDs():
    prere = re.compile('pre')
    # most recent baseline id
    baselineid = db['raw'].find({'version': {'$not': prere}}, {'_id': 1}).sort(
        'commit_date', pymongo.DESCENDING).limit(
        1)
    # 6 newer ids
    newids = db['raw'].find({}, {'_id': 1}).sort('commit_date',
                                                 pymongo.DESCENDING).limit(6)
    outlist = []
    if baselineid.count(True) > 0:
        outlist.append(str(baselineid[0]['_id']))
    for i in range(newids.count(True)):
        outlist.append(str(newids[i]['_id']))

    return outlist


@route("/results")
def results_page():
    """Handler for results page
    """
    # _ids of tests we want to view
    ids = request.GET.getall("id")
    # single db or multi db
    multidb = request.GET.get('multidb', '0 1')
    # x-axis-type 0 == time, 1 == threads
    xaxis = request.GET.get('xaxis', '0')
    spread_dates = True

    if len(ids) == 0:
        ids = getDefaultIDs()

    results = raw_data(None, multidb, None,
                       None, None, None, ids, None, None)

    # check to see if we want the x-axis as time
    if xaxis == '0':
        new_results = []
        dates = set()
        threads = []
        for outer_result in results:
            # goal here is to create "data" and "labels"
            dy_map = {}
            results_section = []
            for result in outer_result['results']:
                # if we need to construct threads
                if len(threads) == 0:
                    threadset = set()
                    for k in result.keys():
                        if k.isdigit():
                            threadset.add(k)
                    threads = list(threadset)
                    threads.sort(key=int)
                result_entry = []
                result_entry.append(result['date'])
                for thread in threads:
                    if thread in result:
                        result_entry.append([result[thread]['ops_per_sec'],
                                             result[thread][
                                                 'standardDeviation']])
                    else:
                        result_entry.append([None, None])
                # here we have [<date>, ops1, ops2...]
                results_section.append(result_entry)

            # construct final object
            labels = ['Commit Date']
            labels.extend(threads)
            new_results.append({'data': json.dumps(results_section),
                                'labels_json': json.dumps(labels),
                                'labels_list': labels})
        return template('results.tpl', results=results, request=request,
                        dygraph_results=new_results, threads=threads,
                        use_dates=True, spread_dates=spread_dates)
    elif xaxis == '1':
        # xaxis is threads
        threads = set()
        dygraph_results = []
        for outer_result in results:
            out = []
            for i, result in enumerate(outer_result['results']):
                out.append(
                    {'label': ' / '.join((result['label'], result['version'],
                                          result['date'],
                                          result['server_storage_engine'])),
                     'data': sorted(
                         [int(k), [v['ops_per_sec'], v['standardDeviation']]]
                         for (k, v) in result.iteritems() if k.isdigit())})
                threads.update(int(k) for k in result if k.isdigit())
            dygraph_data, dygraph_labels = to_dygraphs_data_format(out)
            dygraph_results.append({'data': json.dumps(dygraph_data),
                                    'labels_json': json.dumps(dygraph_labels),
                                    'labels_list': dygraph_labels})
        return template('results.tpl', results=results, request=request,
                        dygraph_results=dygraph_results,
                        threads=sorted(threads),
                        use_dates=False, spread_dates=False)


def to_dygraphs_data_format(in_data):
    """returns js string containing the dygraphs data
    representation of the input and a js string containing
    dygraphs representation of labels
    """

    thread_counts = set()
    ## get all thread counts
    for data_set in in_data:
        for thread_entry in data_set['data']:
            thread_counts.add(thread_entry[0])

    # start by initializing our two new arrays
    graph_data = []
    labels = ["# of Threads"]

    # setup the labels
    for series in in_data:
        labels.append(series['label'])

    # append data for each point
    for thread_count in sorted(thread_counts):
        graph_data.append([])
        point = len(graph_data) - 1
        graph_data[point].append(thread_count)
        for series in in_data:
            thread_count_entry = [None, None]
            for entry in series['data']:
                if (entry[0] == thread_count):
                    thread_count_entry = entry[1]
                    break
            graph_data[point].append(thread_count_entry)

    return graph_data, labels

def get_rows(commit_regex, start_date, end_date, label_regex, version_regex,
             engine_regex):
    if commit_regex is not None:
        commit_regex = '/' + commit_regex + '/'
    if label_regex is not None:
        label_regex = '/' + label_regex + '/'
    if version_regex is not None:
        version_regex = '/' + version_regex + '/'
    if engine_regex is not None:
        engine_regex = '/' + engine_regex + '/'

    csr = db.raw.find({}, {'singledb.results': 0, 'multidb.results': 0,
                           'multidb-multicoll.results': 0})
    csr.sort([('commit_date', pymongo.ASCENDING),
              ('platform', pymongo.ASCENDING),
              ('label', pymongo.ASCENDING),
              ('server_storage_engine',
              pymongo.ASCENDING)])

    rows = []
    for record in csr:
        if 'commit_date' in record.keys():
            commit_date = record["commit_date"].strftime("%b %d  %I:%M %p")
            commit_date_timestamp = time.mktime(
                record["commit_date"].timetuple())
        else:
            commit_date = 'legacy'
            commit_date_timestamp = 0

        if 'run_time' in record.keys():
            run_date = record['run_time'].strftime("%Y-%m-%d %H:%M")
            run_date_timestamp = time.mktime(
                record["run_time"].timetuple())
        else:
            run_date = 'legacy'
            run_date_timestamp = 0

        if 'version' in record.keys():
            server_version = record['version']
        else:
            server_version = 'pending'

        test_holder = None
        if 'singledb' in record.keys():
            test_holder = 'singledb'
        elif 'multidb-multicoll' in record.keys():
            test_holder = 'multidb-multicoll'
        elif 'multidb' in record.keys():
            test_holder = 'multidb'



        if 'server_storage_engine' in record:
            server_storage_engine = record['server_storage_engine']
        else:
            server_storage_engine = DEFAULT_STORAGE_ENGINE

        if 'topology' in record:
            topology = record['topology']
        else:
            topology = DEFAULT_TOPOLOGY

        # Get the threads and the test suites run
        tests = set()
        test_suites = set()
        # thread_count_set = set()

        if test_holder is not None:
            for test in record[test_holder]:
                tests.add(test['name'])
                test_suites.add(test['name'].split(".", 1)[0])
                # for thread_count in test['results']:
                #     if thread_count.isdigit():
                #         thread_count_set.add(thread_count)


        # Calculate the runtime
        if 'end_time' in record.keys() and 'run_time' in record.keys():
            run_time = (record['end_time'] - record['run_time'])
            run_time = '{0:02}:{1:02}:{2:02}'.format(run_time.seconds // 3600,
                                                  run_time.seconds % 3600 // 60,
                                                  run_time.seconds % 60)
        else:
            run_time = None

        writeOptions = False
        if 'writeOptions' in record.keys():
            writeOptions = record['writeOptions']



        tmpdoc = {
            "_id": str(record["_id"]),
            "commit": record["commit"],
            "label": record["label"],
            "version": server_version,
            "commit_date": {
                "display": commit_date,
                "timestamp": int(commit_date_timestamp)
            },
            "run_date": {
                "display": run_date,
                "timestamp": int(run_date_timestamp)
            },
            "platform": record["platform"],
            "writeOptions": writeOptions,
            "run_time": run_time,
            "test_suites": sorted(test_suites),
            "tests": list(sorted(tests)),
            # "threads": sorted(thread_count_set, key=int),
            "server_storage_engine": server_storage_engine,
            "topology": topology
        }

        rows.append(tmpdoc)
    return rows


@route("/")
def new_main_page():
    global filter_cache
    commit_regex = request.GET.get('commit')
    start_date = request.GET.get('start')
    end_date = request.GET.get('end')
    label_regex = request.GET.get('label')
    version_regex = request.GET.get('version')
    nohtml = request.GET.get('nohtml')
    engine_regex = request.GET.get('engine')

    # convert to appropriate type
    if start_date:
        start = datetime.strptime(start_date, '%m/%d/%Y')
    else:
        start = None
    if end_date:
        end = datetime.strptime(end_date, '%m/%d/%Y')
    else:
        end = None

    if ('last_updated' not in filter_cache
        or time.time() > filter_cache['last_updated'] + filter_cache_timeout):
        filter_cache['versions'] = db.raw.aggregate(
            [{"$match": {"version": {"$exists": 1}}},
             {"$group": {"_id": "$version"}},
             {"$sort": {"_id": -1}},
             {"$project": {"_id": 0, "version": "$_id"}}])['result']

        filter_cache['topologies'] = db.raw.aggregate(
            [{"$match": {"topology": {"$exists": 1}}},
             {"$group": {"_id": "$topology"}},
             {"$sort": {"_id": 1}},
             {"$project": {"_id": 0, "topology": "$_id"}}])['result']

        filter_cache['storage_engines'] = db.raw.aggregate(
            [{"$match": {"server_storage_engine": {"$exists": 1}}},
             {"$group": {"_id": "$server_storage_engine"}},
             {"$sort": {"_id": 1}},
             {"$project": {"_id": 0, "server_storage_engine": "$_id"}}])['result']

        filter_cache['platforms']  = db.raw.aggregate(
            [{"$match": {"platform": {"$exists": 1}}},
             {"$group": {"_id": "$platform"}},
             {"$sort": {"_id": 1}},
             {"$project": {"_id": 0, "platform": "$_id"}}])['result']

        singledb_tests = db.raw.aggregate(
            [{"$unwind": "$singledb"},
            {"$group":{"_id":"$singledb.name"}},
            {"$sort": {"_id": 1}},
            {"$project": {"_id": 0, "test": "$_id"}}])['result']
        multi_tests = db.raw.aggregate(
            [{"$unwind": "$multidb"},
             {"$group":{"_id":"$multidb.name"}},
             {"$sort": {"_id": 1}},
             {"$project": {"_id": 0, "test": "$_id"}}])['result']

        all_tests = set()
        for test in singledb_tests:
            all_tests.add(test['test'])
        for test in multi_tests:
            all_tests.add(test['test'])

        filter_cache['tests'] = sorted(all_tests)
        filter_cache['last_updated'] = time.time()

    rows = get_rows(commit_regex, start, end, label_regex, version_regex,
                    engine_regex)

    if nohtml:
        response.content_type = 'application/json'
        return json.dumps(rows)
    else:
        return template('comp.tpl', allrows=rows,
                        versions=filter_cache['versions'],
                        storage_engines=filter_cache['storage_engines'],
                        platforms=filter_cache['platforms'],
                        tests=filter_cache['tests'],
                        table_data=json.dumps(rows),
                        topologies=filter_cache['topologies'])


@route("/catalog")
def get_catalog():
    # commit_regex = request.GET.get('commit')
    # start_date = request.GET.get('start')
    # end_date = request.GET.get('end')
    # label_regex = request.GET.get('label')
    # version_regex = request.GET.get('version')
    # engine_regex = request.GET.get('engine')
    # # convert to appropriate type
    # if start_date:
    # start = datetime.strptime(start_date, '%m/%d/%Y')
    # else:
    # start = None
    # if end_date:
    # end = datetime.strptime(end_date, '%m/%d/%Y')
    # else:
    # end = None

    rows = get_rows(None, None, None, None, None, None)
    response.content_type = 'application/json'
    return json.dumps({"data": rows})


if __name__ == '__main__':
    do_reload = '--reload' in sys.argv
    run(host=SERVER_BIND_IP, port=SERVER_PORT, server=AutoServer, debug=True)
