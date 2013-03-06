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

@route("/host_info/")
def host_info():
    result = {}
    result['date'] = request.GET.get('date', '')
    result['platform'] = request.GET.get('platform', '')
    result['version'] = request.GET.get('version', '')
    result['bits'] = request.GET.get('bits', '')
    result['options'] = request.GET.get('options', '')
    analysis_info = db.info.find_one({  "build_info.version" : result['version'],
                                        "platform.os.name" : result['platform'], 
                                        "build_info.bits" : int(result['bits']),
                                        "run_date" : result['date'],
                                        "options" : result['options']
                                    })
    return template('host_info.tpl'
        , details=analysis_info)

@route("/raw")
def raw_data():
    out = []

    versions = request.GET.get('versions', '')
    if versions:
        if versions.startswith('/') and versions.endswith('/'):
            version_query = {'build_info.version': {'$regex': versions[1:-1]}}
        else:
            version_query = {'build_info.version': {'$in': versions.split()}}
    else:
        version_query = {}

    date = request.GET.get('date', '')
    if date:
        if date.startswith('/') and date.endswith('/'):
            date_query = {'run_date': {'$regex': date[1:-1]}}
        else:
            date_query = {'run_date': {'$in': date.split()}}
    else:
        date_query = {}

    cursor = db.raw.find({"$and":[date_query, version_query]}).sort([
    ('name',pymongo.ASCENDING), ('build_info.version',pymongo.ASCENDING), 
    ('run_date',pymongo.DESCENDING)])

    name = None
    results = []
    for result in cursor:
        if result['name'] != name:
            if name is not None:
                out.append({'name':name, 'results':results})
            name = result['name']
            results = []

        row = dict( platform=result['platform'],
                    version=result['version'], 
                    commit=result['commit'],
                    date=result['run_date'],
                    options=result['options'],
                    bits=result['bits'],)
        for (n, res) in result['results'].iteritems():
            row[n] = res

        results.append(row)

    out.append({'name':name, 'results':results})
    return out

@route("/")
def main_page():
    metric = request.GET.get('metric', 'ops_per_sec')

    results = raw_data()

    threads = set()
    flot_results = []
    for outer_result in results:
        out = []
        for i, result in enumerate(outer_result['results']):
            out.append({'label': result['version']
                       ,'data': sorted([int(k), v[metric]] for (k,v) in result.iteritems() if k.isdigit())
                       })
            threads.update(int(k) for k in result if k.isdigit())
        flot_results.append(json.dumps(out))

    return template('main_page.tpl'
                   ,results=results
                   ,flot_results=flot_results
                   ,request=request
                   ,threads=sorted(threads)
                   )

if __name__ == '__main__':
    do_reload = '--reload' in sys.argv
    debug(do_reload)
    debug(True)
    run(reloader=do_reload, host='0.0.0.0', server=AutoServer)



