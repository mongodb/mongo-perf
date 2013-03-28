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

"""Manages processing and analysis of benchmark data."""

import logging
import pymongo
import requests
import subprocess
from math import sqrt
from time import sleep
from hashlib import md5
from time import strptime
from string import Template
from threading import Thread
from boto import connect_ses
from datetime import datetime
from Queue import Queue, Empty
from traceback import format_exc
from collections import defaultdict
from datetime import datetime, timedelta

LOGR = logging.getLogger('mongo-perf-alerting')

# database globals
MONGO_PERF_HOST = "localhost"
MONGO_PERF_PORT = 27017
MP_DB_NAME = "bench_results"
RAW_COLLECTION = "raw"
ANALYSIS_COLLECTION = "analysis"
ALERT_HISTORY_COLLECTION = "alertHistory"

# report globals
REPORT_INFO_HEADER = Template('''Dear User,
<br><br>
Here are the reports generated for $date:
<br><br>
''')

NO_REPORT_INFO_HEADER = Template('''Dear User,
<br><br>
Metrics seem be be performing fine for $date!
<br><br>
''')

REPORT_BODY = Template('''
Platform: $platform<br>
Label: $label<br>
Version: $version<br>
Metric: $metric<br>
<a href="$link">Anomalies</a>: 
$anomalies<br><br>
''')

# alert globals
ALERT_INFO_HEADER = Template('''Dear User,
<br><br>
Here are the alerts generated for $date:
<br><br>
''')


class Definition(object):
    """A Definition encapsulates information pertaining to 
        the alerts and reports
    """
    def __init__(self, params, *args, **kwargs):
        """ Get a definition given parameters.

        :Parameters:
          - `params`: dict containing definition
        """
        self.state = 'not started'
        self.name = params.get('name', '')
        self.labels = params.get('labels', '')
        self.versions =  params.get('versions', '')
        self.operations = params.get('operations', '')
        self.metric = params.get('metric', 'ops_per_sec')
        self.recipients = params.get('recipients', '')
        self.pipeline = params.get('pipeline', None)
        self._result = defaultdict(lambda : defaultdict(list))

        try:
            self.threshold = float(params.get('threshold'))
        except TypeError:
            raise TypeError("threshold must be an numeric "
                            "in %s definition" % (self.name,))

    @property
    def result(self):
        return self._result

    def __str__(self):
        return self.name

    def __repr__(self):
        return md5(self.name).hexdigest()

class AlertDefinition(Definition):
    """An Alert encapsulates a specific computation to be
        performed within the context of a alert definition 
    """

    def __init__(self, params):
        """Get an alert definition object

        :Parameters:
          - `params`: dict containing definition
        """
        super(AlertDefinition, self).__init__(params)
        self.comparator = params.get('comparator', '')
        self.transform = params.get('transform', 'avg')
        self.epochType = params.get('epochType', 'daily')
        self._threads =  params.get('threads', [])
        self.data = {}
        self.alerts = {}

        try:
            self.epochCount = int(params.get('epochCount', '0'))
        except TypeError:
            raise TypeError("epochCount must be an integer "
                            "in %s definition" % (self.name,))
    @property
    def threads(self):
        return self._threads

    @threads.setter
    def threads(self, values):
        try:
            for value in values:
                self._threads.append(str(value))
        except ValueError, e:
            LOGR.critical("threads must be an integer in alert"\
            " definition for {0} definition".format(self.name))
            raise

class ReportDefinition(Definition):
    """A Report encapsulates report notification jobs
    """

    def __init__(self, params):
        """Get an report definition object

        :Parameters:
          - `params`: dict containing definition
        """
        super(ReportDefinition, self).__init__(params)
        self.homogeneity = float(params.get('homogeneity', '0'))
        self.aggregate = ''
        # we use a static window of 2 days
        self.window = 2

    @property
    def report(self):
        return self.aggregate

class Processor(Thread):
    """A Processor 'processes' a given definition by taking it 
        through a number of predefined stages in a pipeline
    """

    def __init__(self, queue, *args, **kwargs):
        Thread.__init__(self)
        self.queue = queue
        self.connection = None
        self.database = None
        self.error = None
        self.tasks = []
        self.date = datetime.now()

    def connect(self):
        """Connect to mongo-perf database
        """
        try:
            self.connection = pymongo.Connection(
                                host=MONGO_PERF_HOST,
                                port=MONGO_PERF_PORT)
            self.database = self.connection[MP_DB_NAME]
        except BaseException, e:
            raise

    def run(self):
        """Launch processor from definitions queue
        """
        while True:
            try:
                definition = self.queue.get()
                self.process_definition(definition)
            except BaseException, e:
                self.error = format_exc()
                raise
            finally:
                if self.error:
                    LOGR.critical('Error in pipeline for {0}'\
                        .format(definition.name))
                    LOGR.critical('{0}'.format(self.error))
                    
                self.queue.task_done()

    def process_definition(self, definition):
        """Perform each task for given definition
        """
        LOGR.info('Commencing pipeline processing for {0}'.\
                    format(definition.name))
        self.connect()

        for index, stage in enumerate(definition.pipeline):
            LOGR.info('Running {0} for {1}...'. \
                    format(stage, definition.name))
            try:
                self.dispatch_handler(stage)(definition)
            except:
                raise

    def dispatch_handler(self, stage):
        """Call the given handler for this pipeline stage
        """
        name = '_'.join(stage.split())
        handler = getattr(self, name, None)
        if not handler:
            raise BaseException('No handler defined for ' + name)
        return handler


    """Reporting pipeline stage handlers below."""


    def process_benchmarks(self, definition):
        """Runs mongo-perf.R script to process benchmark results
        """
        start_date = self.date - timedelta(days=definition.window)
        start_date, end_date = map(lambda d : \
        d.strftime('%Y-%m-%d'), [start_date, self.date])

        for label in definition.labels:
            platform = self.get_platform(RAW_COLLECTION, label)
            for version in definition.versions:
                argv = " ".join(map(str, [start_date, end_date, \
                    label, platform, version, definition.window]))
                try:
                    analysis = subprocess.Popen(['Rscript', \
                        'mongo-perf.R', start_date, end_date, str(label), \
                        str(platform), str(version), str(definition.window)], \
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    LOGR.info("Started mongo-perf.R with args: " + argv)
                    output, error = analysis.communicate()
                    LOGR.info(output)
                    if error:
                        raise BaseException('Nonzero exit from mongo-perf.R', error)
                except BaseException, e:
                    raise

    def pull_results(self, definition):
        """Pull benchmarked results from database
        """
        metrics = self.get_metrics(RAW_COLLECTION)
        date = self.date.strftime('%Y-%m-%d')
        for metric in metrics:
            for label in definition.labels:
                platform = self.get_platform(RAW_COLLECTION, label)
                if not platform:
                    raise BaseException("Label", label, "not found")
                for version in definition.versions:
                    cursor = self.database['analysis'].find({
                    "label" : label, "version" : version,
                    "date" : date, "metric" : metric,
                    "platform" : platform})
                    job_str = ';'.join(map(str, \
                    [metric, label, platform, version]))
                    job_hash = md5(job_str).hexdigest()
                    self.tasks.append({ job_str : cursor })

    def analyze_results(self, definition):
        """Analyzes data produced by mongo-perf.R
        """
        key_date = (self.date - timedelta(days=1)).strftime('%Y-%m-%d')
        for task in self.tasks:
            task_key = task.keys()[0]
            cursor = task.values()[0]
            if cursor.count() == 0:
                alert = ' '.join(task.keys())
                LOGR.critical("No data for {0}".format(alert))
            for data in cursor:
                results = data['result']
                res_map = defaultdict(list)
                for result in results:
                    # only report anomalies on key_date
                    if result['run_date'] == key_date:
                        res_map[result['test']].append(result)
                for test in res_map:
                    data_points = sorted(res_map[test], 
                    key=lambda k : (abs(k['AV'])), reverse=True)
                    for dp in data_points:
                        if dp['test.AV'] > definition.threshold:
                            definition.result[task_key][test].append(dp)

    def prepare_report(self, definition):
        """Prepare report based on analyzed data
        """
        window = '+'.join(self.get_window(self.date, definition.window, 1))
        key_date = self.date.strftime('%Y-%m-%d')

        for top_level in definition.result:
            values = {}
            keys = top_level.split(';')
            values['metric'], values['label'], \
            values['platform'], values['version'] = keys
            values['anomalies'], values['link'] = '', ''
            values['date'] = key_date

            for test in definition.result[top_level]:
                anomaly_list = []
                anomalies = definition.result[top_level][test]

                for anomaly in anomalies:
                    target_trend = 'decreasing'
                    thread = anomaly['thread_count']
                    # can't have an anomaly here
                    if thread == '1' and \
                    values['metric'] == 'speedup':
                        break
                    if anomaly['AV'] < 0 and \
                    anomaly['y.3'] > anomaly['y.2']:
                        target_trend = 'increasing'

                    homogeneity = (100 - anomaly['madindex.AV'])
                    series_trend = "homogenous"
                    if homogeneity < definition.homogeneity:
                        homogeneity = "%0.2f%%" % abs(homogeneity)
                        anomaly_str = "'%s' might be %s in " \
                            "performance - see thread %s (trends %s" \
                            " at %s)" % (test, target_trend, thread, \
                            series_trend, homogeneity)
                        anomaly_list.append(anomaly_str)
            
                if anomaly_list:
                    values['anomalies'] += '<br>'
                    values['anomalies'] += '<br>'.join(anomaly_list)
                    values['link'] = '%s/results?metric=%s&labels=' \
                                '%s&platforms=%s&versions=%s&dates=%s' \
                                % (MONGO_PERF_HOST, keys[0], keys[1], \
                                keys[2], keys[3], window)

            if values['anomalies']:
                definition.aggregate += REPORT_BODY.substitute(values)

    def send_report(self, definition):
        """Sends report based on generated report
        """
        date = self.date.strftime('%Y-%m-%d')

        if definition.report:
            header = REPORT_INFO_HEADER.substitute({ "date" : date })
            message = header + definition.report
            conn = connect_ses().send_email(
            "mongo-perf admin <wisdom@10gen.com>",
            "MongoDB Performance Report", message, 
            definition.recipients[0], format="html")
        else:
            message = NO_REPORT_INFO_HEADER.substitute({'date' : date})
            conn = connect_ses().send_email(
            "mongo-perf admin <wisdom@10gen.com>",
            "MongoDB Performance Report", message, 
            definition.recipients, format="html")



    """Alert pipeline stage handlers below."""


    def pull_data(self, definition):
        """Load the given alert into processor's data
        """
        count = definition.epochCount
        skip = 1

        if definition.epochType == 'weekly':
            skip = 7
        elif definition.epochType == 'monthly':
            skip = 30

        window = self.get_window(self.date, count, skip)
        operations = self.find_operations(definition.operations)

        for operation in operations:
            for label in definition.labels:
                platform = self.get_platform(RAW_COLLECTION, label)
                for version in definition.versions:
                    task = ','.join(map(str, (operation, label, platform)))
                    cursor = self.database[RAW_COLLECTION].find( {
                        'label': label,
                        'name' : operation,
                        'run_date' : { '$in' : window },
                        'version' : version } )
                    # hash = md5(str(definition)+(task)).hexdigest()
                    self.tasks.append(task)
                    data = self.parse_data(cursor, definition)
                    definition.data[task] = data

    def process_alerts(self, definition):
        """Handle sifting through alerts and preparing
            results from transformation
        """
        date = self.date.strftime('%Y-%m-%d')
        index = 0
        for task in self.tasks:
            dates, data = definition.data[task]
            if data:
                current_index = dates.index(sorted(dates)[len(dates) - 1])
                for thread in definition.threads:
                    value = self.transform_helper(definition.transform, \
                        data[definition.metric][thread], current_index)
                    alert = {}
                    alert['transform'] = definition.transform
                    alert['alert_name'] = definition.name
                    alert['thread_count'] = thread
                    alert['test'], alert['label'], \
                    alert['platform'] = task.split(',')
                    alert['value'] = value
                    alert['trigger_date'] = date
                    definition.alerts[index] = alert
                    index += 1
            
    def transform_helper(self, transform, data, current_index):
        """Performs the given transformation on data passed in
        """
        result = ''
        if transform == 'std_dev':
            mean = sum(data) / len(data)
            result = sqrt( sum ( ( point - mean ) ** 2 \
                        for point in data) / (len(data) - 1))
        elif transform == 'mean':
            result = sum(data) / len(data)
        elif transform == 'actual':
            result = data[current_index]
        elif transform == 'fourier':
            result = None
        return result
            
    def persist_results(self, definition):
        """Store triggered alerts
        """
        for index in definition.alerts:
            alert = definition.alerts[index]
            if self.passes_threshold(definition, alert):
                self.database[ALERT_HISTORY_COLLECTION].insert(alert)

    def passes_threshold(self, definition, alert):
        """Returns True if the given alert passes the 
            comparator, threshold test
        """
        if definition.comparator == "<":
            if alert['value'] < definition.threshold:
                return True
        elif definition.comparator == ">":
            if alert['value'] > definition.threshold:
                return True
        elif definition.comparator == "=":
            if alert['value'] == definition.threshold:
                return True
        return False



    """General helper methods below."""

    def find_operations(self, operations):
        """Get all tests that match any of the operations
        """
        ops = set()

        for operation in operations:
            for op in self.database[RAW_COLLECTION].find \
            ({'name' :{'$regex': operation, '$options' : 'i'}}, \
            {'name' : 1, '_id' : 0 }):
                ops.add(op['name'])
        return ops

    def get_keys(collection, key):
        """Get all distinct values of the given key
        """
        return sorted(self.database[collection].distinct(key), \
                        reverse=True)

    def get_metrics(self, collection):
        """Get all metrics we have in database
        """
        return self.database[collection].find_one() \
                    ['benchmarks'][0]['results']. \
                    itervalues().next().keys()

    def get_platform(self, collection, label):
        """Get platform name given label
        """
        record = self.database[collection].find_one({'label':label})
        if record:
            return record['platform']

    def get_window(self, current, count, skip):
        """Get a window going back from current
            along with a given count and skip value
        """
        skip = timedelta(days=skip)
        window = []
        for n in xrange(count + 1):
            window.append(current.strftime('%Y-%m-%d'))
            current -= skip

        return window
        
    def parse_data(self, cursor, definition):
        """Transform data into a more amenable form
        """
        parse = defaultdict(lambda : defaultdict(list))
        dates = []
        for record in cursor:
            dates.append(record['run_date'])
            print 'ddd'
            results = record['results']
            for thread in results:
                if thread in definition.threads:
                    parse[definition.metric][thread].\
                    append(results[thread][definition.metric])

        return dates, parse
        
