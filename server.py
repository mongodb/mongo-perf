#!/usr/bin/python
from bottle import *
import pymongo
from datetime import datetime
import sys
import json

db = pymongo.Connection('localhost', 27017)['bench_results']

@route('/static/:filename#.*#')
def static_file(filename):
    send_file(filename, root='./static')

@route("/host")
def host_info():
    result = {}
    result['date'] = request.GET.get('date', '')
    result['label'] = request.GET.get('label', '')
    result['version'] = request.GET.get('version', '')
    analysis_info = db.info.find_one({  "build_info.version" : result['version'],
                                        "label" : result['label'], 
                                        "run_date" : result['date']
                                    })
    return template('host.tpl'
        , details=analysis_info)

@route("/raw")
def raw_data(versions, labels, dates, platforms, start, end, limit):
    out = []

    if not limit:
        limit = 10
    else:
        limit = int(limit)

    if start:
        start_query = {'run_date': {'$gt': start } }
    else:
        start_query = {}

    if end:
        end_query = {'run_date': {'$lt': end } }
    else:
        end_query = {}

    if versions:
        if versions.startswith('/') and versions.endswith('/'):
            version_query = {'version': {'$regex': versions[1:-1], '$options' : 'i'}}
        else:
            version_query = {'version': {'$in': versions.split(" ")}}
    else:
        version_query = {}

    if platforms:
        if platforms.startswith('/') and platforms.endswith('/'):
            platforms_query = {'platform': {'$regex': platforms[1:-1], '$options' : 'i'}}
        else:
            platforms_query = {'platform': {'$in': platforms.split(" ")}}
    else:
        platforms_query = {}

    if dates:
        if dates.startswith('/') and dates.endswith('/'):
            date_query = {'run_date': {'$regex': dates[1:-1], '$options' : 'i'}}
        else:
            date_query = {'run_date': {'$in': dates.split(" ")}}
    else:
        date_query = {}

    if labels:
        if labels.startswith('/') and labels.endswith('/'):
            label_query = {'label': {'$regex': labels[1:-1], '$options' : 'i'}}
        else:
            label_query = {'label': {'$in': labels.split(" ")}}
    else:
        label_query = {}

    # print label_query, date_query, platforms_query, version_query, end_query, start_query
    cursor = db.raw.find({"$and":[label_query
                                , date_query
                                , platforms_query
                                , version_query
                                , end_query
                                , start_query]}).sort([
                                  ('name',pymongo.ASCENDING)
                                , ('build_info.version',pymongo.ASCENDING)
                                , ('run_date',pymongo.DESCENDING)]).limit(limit)
    # print cursor.count()
    name = None
    results = []
    for result in cursor:
        if result['name'] != name:
            if name is not None:
                out.append({'name':name, 'results':results})
            name = result['name']
            results = []

        row = dict( label=result['label'],
                    platform=result['platform'], 
                    version=result['version'], 
                    commit=result['commit'],
                    date=result['run_date'])
        for (n, res) in result['results'].iteritems():
            row[n] = res

        results.append(row)

    out.append({'name':name, 'results':results})
    return out

@route("/results")
def results_page():
    metric = request.GET.get('metric', 'ops_per_sec')
    versions = ' '.join(request.GET.getall('versions'))
    dates = ' '.join(request.GET.getall('dates'))
    labels = ' '.join(request.GET.getall('labels'))
    platforms = ' '.join(request.GET.getall('platforms'))
    limit = ' '.join(request.GET.getall('limit'))
    start = request.GET.get('start')
    end = request.GET.get('end')
    results = raw_data(versions, labels, dates, platforms, start, end, limit)

    threads = set()
    flot_results = []
    for outer_result in results:
        out = []
        for i, result in enumerate(outer_result['results']):
            out.append({'label': " - ".join((result['label'], result['version'], result['date']))  # + " (" + result['commit'][:7] + ")"
                       ,'data': sorted([int(k), v[metric]] for (k,v) in result.iteritems() if k.isdigit())
                       })
            threads.update(int(k) for k in result if k.isdigit())
        flot_results.append(json.dumps(out))

    return template('results.tpl'
                   ,results=results
                   ,flot_results=flot_results
                   ,request=request
                   ,threads=sorted(threads)
                   )

@route("/")
def main_page():
    # db.info.distinct("platform.os.name")
    platforms = db.raw.distinct("platform")
    num_tests = len(db.raw.distinct("name"))
    num_labels = len(db.raw.distinct("label"))
    rows = None
    versions = sorted(db.info.distinct("build_info.version"), reverse=True)
    if versions:
        cursor = db.raw.find({"version" : versions[0]}).sort([
        ('run_date',pymongo.DESCENDING), 
        ('platform',pymongo.DESCENDING), 
        ('build_info.version',pymongo.DESCENDING)]).limit(num_labels * num_tests)
        needed = ['label', 'platform', 'run_date', 'version']
        rows = []
        for record in cursor:
            rows.append({ key : record[key] for key in needed })
        rows = sorted([dict(t) for t in set([tuple(d.items()) for d in rows])], reverse=True)

    return template('main.tpl',
                    rows=rows,
                    versions=versions,
                    platforms=platforms)

if __name__ == '__main__':
    do_reload = '--reload' in sys.argv
    debug(do_reload)
    debug(True)
    run(reloader=do_reload, host='0.0.0.0', server=AutoServer)



