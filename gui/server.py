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

import sys
import json
import pymongo
import bson
from bottle import *
import logging as logr
import logging.handlers
from datetime import datetime
from collections import defaultdict
from copy import copy

from pprint import pprint

MONGO_PERF_HOST = "localhost"
MONGO_PERF_PORT = 27017
MP_DB_NAME = "bench_results"
db = pymongo.Connection(host=MONGO_PERF_HOST, 
                         port=MONGO_PERF_PORT)[MP_DB_NAME]


@route('/static/:filename#.*#')
def send_static(filename):
    return static_file(filename, root='./static')

def gen_query(labels, dates, start, end, limit, ids, commits):
    if start:
        start_query = {'run_time': {'$gte': start}}
    else:
        start_query = {}

    if end:
        end_query = {'run_time': {'$lte': end}}
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

    if ids:
        objids = []
        for id in ids:
            objids.append(bson.objectid.ObjectId(id));
        id_query = {'_id': {'$in': objids}}
    else:
        id_query = {}

    if commits:
        if commits.startswith('/') and commits.endswith('/'):
            commit_query = {'commit': { '$regex': commits[1:-1] }}
    else:
        commit_query = {}

    query = {"$and": [label_query, date_query, start_query, end_query, id_query, commit_query]}
    cursor = db.raw.find(query).sort([ ('run_date', pymongo.ASCENDING), 
                                    ('platform', pymongo.DESCENDING)])
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
                               date=entry['run_time'].isoformat(),
                               label=entry['label'])
                    for (n, res) in result['results'].iteritems():
                        row[n] = res
                    aggregate[result['name']].append(row)

    aggregate = sorted(aggregate.iteritems(), key=lambda (k, v): k)
    out = []

    for item in aggregate:
        out.append({'name': item[0], 'results': item[1]})

    return out

def raw_data(labels, multidb, dates, start, end, limit, ids, commits):
    cursor = gen_query(labels, dates, start, end, limit, ids, commits)
    result = process_cursor(cursor, multidb)
    return result

@route("/results")
def results_page():
    """Handler for results page
    """
    #_ids of tests we want to view
    ids = request.GET.getall("id")
    # specific dates for tests to be viewed
    dates = request.GET.getall('dates')
    # test host label
    labels = request.GET.getall('labels')
    # # of tests to return
    limit = request.GET.get('limit')
    # tests run from this date (used in range query)
    start = request.GET.get('start')
    # tests run before this date (used in range query)
    end = request.GET.get('end')
    # single db or multi db
    multidb = request.GET.get('multidb', '0 1')
    # x-axis-type 0 == time, 1 == threads
    xaxis = request.GET.get('xaxis', '0')
    # spread dates
    spread = request.GET.get('spread', '0')
    spread_dates = True if spread == '1' else False

    results = raw_data(labels, multidb, dates,
                       start, end, limit, ids, None)

    #check to see if we want the x-axis as time
    if xaxis == '0':
        new_results = []
        dates = set()
        threads = [] 
        for outer_result in results:
            #goal here is to create "data" and "labels"
            dy_map = {}
            results_section = []
            for result in outer_result['results']:
                #if we need to construct threads
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
                    result_entry.append([result[thread]['ops_per_sec'], result[thread]['standardDeviation']])
                #here we have [<date>, ops1, ops2...]
                results_section.append(result_entry)

            #construct final object
            labels = ['Run Date']
            labels.extend(threads)
            new_results.append({ 'data': json.dumps(results_section),
                                 'labels_json': json.dumps(labels),
                                 'labels_list': labels})
        print "USING DATES"
        return template('results.tpl', results=results, request=request,
                        dygraph_results=new_results, threads=sorted(threads),
                        use_dates=True, spread_dates=spread_dates)
    elif xaxis == '1':
        #xaxis is threads
        threads = set()
        dygraph_results = []
        for outer_result in results:
            out = []
            for i, result in enumerate(outer_result['results']):
                out.append({'label': ' / '.join((result['label'], result['version'],
                                                 result['date'])),
                            'data': sorted([int(k), [v['ops_per_sec'], v['standardDeviation']]] 
                                           for (k, v) in result.iteritems() if k.isdigit())})
                threads.update(int(k) for k in result if k.isdigit())
            dygraph_data, dygraph_labels = to_dygraphs_data_format(out)
            dygraph_results.append({'data': json.dumps(dygraph_data),
                                    'labels_json': json.dumps(dygraph_labels),
                                    'labels_list': dygraph_labels})
        return template('results.tpl', results=results, request=request,
                        dygraph_results=dygraph_results, threads=sorted(threads),
                        use_dates=False, spread_dates=False)



def to_dygraphs_data_format(in_data):
    """returns js string containing the dygraphs data
    representation of the input and a js string containing
    dygraphs representation of labels
    """
    #start by initializing our two new arrays
    d = in_data[0]
    graph_data = copy(d['data'])
    labels =["# of Threads", d['label']]

    #append data for each point
    for series in in_data[1:]:
        data = series['data']
        for point in range(len(graph_data)):
            graph_data[point].append(data[point][1])
        labels.append(series['label'])

    return graph_data, labels

def get_rows(commit_regex, date_regex, label_regex):
    if commit_regex is not None:
        commit_regex = '/' + commit_regex + '/'
    if date_regex is not None:
        date_regex = '/' + date_regex + '/'
    if label_regex is not None:
        label_regex = '/' + label_regex + '/'
    
    csr = gen_query(label_regex, date_regex, None, None, None, None, commit_regex)
    rows = []
    for record in csr:
        tmpdoc = {"commit": record["commit"],
                  "label": record["label"],
                  "date": record["run_time"].isoformat(),
                  "_id": str(record["_id"])}
        rows.append(tmpdoc) 
    return rows

@route("/")
def new_main_page():
    commit_regex = request.GET.get('commit')
    date_regex = request.GET.get('date')
    label_regex = request.GET.get('label')
    nohtml = request.GET.get('nohtml')

    rows = get_rows(commit_regex, date_regex, label_regex)

    if nohtml:
        response.content_type = 'application/json'
        return json.dumps(rows)
    else: 
        return template('comp.tpl', allrows=rows)


if __name__ == '__main__':
    do_reload = '--reload' in sys.argv
    run(host='0.0.0.0', port=8080, server=AutoServer, debug=do_reload)
