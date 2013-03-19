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
def host_page():
    result = {}
    result['date'] = request.GET.get('date', '')
    result['label'] = request.GET.get('label', '')
    result['version'] = request.GET.get('version', '')
    host = db.host.find_one({   "build_info.version" : result['version'],
                                "label" : result['label'], 
                                "run_date" : result['date']
                            })
    return template('host.tpl'
        , host=host)

@route("/raw")
def raw_data(versions, labels, dates, platforms, start, end):
    out = []

    if start:
        start_query = {'run_date': {'$gte': start } }
    else:
        start_query = {}

    if end:
        end_query = {'run_date': {'$lte': end } }
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

    cursor = db.raw.find({"$and":[version_query
                                , label_query
                                , platforms_query
                                , date_query
                                , start_query
                                , end_query]}).sort([
                                  ('name',pymongo.ASCENDING)
                                , ('run_date',pymongo.DESCENDING)])
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
    multi = ' '.join(request.GET.getall('multi'))
    start = request.GET.get('start')
    end = request.GET.get('end')
    if multi:
        results = []
        try:
            from ast import literal_eval
            for platform in literal_eval(multi):
                result = literal_eval(json.dumps(platform))
                result = { attrib : '/' + result[attrib] + '/' for attrib in result }
                tmp = raw_data(result['version'], result['label'], 
                result['run_date'], result['platform'], None, None)
                for result in tmp:
                    results.append(result)
            results = merge(results)
        except:
            pass
    else:
        results = raw_data(versions, labels, dates, platforms, start, end)

    threads = set()
    flot_results = []
    for outer_result in results:
        out = []
        for i, result in enumerate(outer_result['results']):
            out.append({'label': " - ".join((result['label'], result['version'], result['date']))
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

def merge(results):
    out = []
    outer = {}
    for result in results:
        if result['name'] not in outer.keys():
            outer[result['name']] = []
        row = dict( label=result['results'][0]['label'],
                    platform=result['results'][0]['platform'], 
                    version=result['results'][0]['version'], 
                    commit=result['results'][0]['commit'],
                    date=result['results'][0]['date'])
        for (n, res) in result['results'][0].iteritems():
            row[n] = res
        outer[result['name']].append(row)
    for name in outer:
        out.append({'name' : name, 'results' : outer[name]})
    return out

@route("/")
def main_page():
    platforms = db.raw.distinct("platform")
    num_tests = len(db.raw.distinct("name"))
    num_labels = len(db.host.distinct("label"))
    rows = None
    versions = sorted(db.host.distinct("build_info.version"), reverse=True)
    # restricted to benchmark tests for most recent mongoDB version
    # consider using capped collection for this instead
    if versions:
        cursor = db.raw.find({"version" : versions[0]}).limit(num_labels * num_tests)
        needed = ['label', 'platform', 'run_date', 'version']
        rows = []
        for record in cursor:
            rows.append({ key : record[key] for key in needed })
        rows = sorted([dict(t) for t in set([tuple(d.items()) for d in rows])]
                        , key=lambda t: (t['run_date'], t['label']), reverse=True)

    return template('main.tpl',
                    rows=rows,
                    versions=versions,
                    platforms=platforms)

if __name__ == '__main__':
    do_reload = '--reload' in sys.argv
    debug(do_reload)
    debug(True)
    run(reloader=do_reload, host='0.0.0.0', server=AutoServer)



