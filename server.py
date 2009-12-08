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

    cursor = db.raw.find().sort([('name',1), ('mongodb_date',-1)])

    name = None
    results = []
    for result in cursor:
        if result['name'] != name:
            if name is not None:
                out.append({'name':name, 'results':results})
            name = result['name']
            results = []
        results.append(dict(version=result['mongodb_version']
                           ,date=result['mongodb_date']
                           ,one=result['results']['one']
                           ,two=result['results']['two']
                           ,four=result['results']['four']
                           ,ten=result['results']['ten']
                           ))

    out.append({'name':name, 'results':results})
    return out

@route("/")
def main_page():
    metric = request.GET.get('metric', 'ops_per_sec')

    results = raw_data()

    flot_results = []
    for outer_result in results:
        out = []
        for i, result in enumerate(outer_result['results']):
            out.append({'label': result['version'],
                        'data': [[1, result['one'][metric]],
                                 [2, result['two'][metric]],
                                 [4, result['four'][metric]],
                                 [10, result['ten'][metric]]]})
        flot_results.append(json.dumps(out))


    return template('main_page.tpl', results=results, flot_results=flot_results, metric=metric)
    

if __name__ == '__main__':
    do_reload = '--reload' in sys.argv
    debug(do_reload)
    run(reloader=do_reload)
 



