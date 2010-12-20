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

@route("/raw")
def raw_data():
    out = []

    versions = request.GET.get('versions', '').split()
    if versions:
        q = {'mongodb_version': {'$in': versions}}
    else:
        q = {}

    cursor = db.raw.find(q).sort([('name',1), ('mongodb_date',-1), ('mongodb_git',1)])

    name = None
    results = []
    for result in cursor:
        if result['name'] != name:
            if name is not None:
                out.append({'name':name, 'results':results})
            name = result['name']
            results = []

        row = dict(version=result['mongodb_version'], date=result['mongodb_date'])
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
    run(reloader=do_reload)



