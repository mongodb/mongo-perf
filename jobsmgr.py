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
from sys import platform
from os.path import join
from time import strptime
from os.path import abspath
from string import Template
from threading import Thread
from boto import connect_ses
from os.path import realpath
from datetime import datetime
from Queue import Queue, Empty
from traceback import format_exc
from collections import defaultdict
from datetime import datetime, timedelta

LOGR = logging.getLogger('mongo-perf-log.txt')

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
Label: $label<br>
Platform: $platform<br>
Version: $version<br>
Metric: $metric
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
    def __init__(self, *args, **kwargs):
        """ Get a definition given parameters.

        """
        self.state = 'not started'
        self.name = kwargs.get('name', '')
        self.labels = kwargs.get('labels', '')
        self.versions =  kwargs.get('versions', '')
        self.operations = kwargs.get('operations', '')
        self.metric = kwargs.get('metric', 'ops_per_sec')
        self.recipients = kwargs.get('recipients', '')
        self.pipeline = kwargs.get('pipeline', None)
        self._result = defaultdict(lambda : defaultdict(list))

        try:
            self.threshold = float(kwargs.get('threshold'))
        except TypeError:
            raise TypeError("threshold must be an numeric "
                            "in {0} definition".format(self.name))

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

    def __init__(self, *args, **kwargs):
        """Get an alert definition object
        """
        super(AlertDefinition, self).__init__(*args, **kwargs)
        self.transform = args[0]
        self.comparator = args[1]
        self.epoch_type = args[2]
        self.set_threads(args[3])
        self.set_epoch_count(args[4])
        self.data = {}
        self.alerts = {}

    @property
    def epoch_count(self):
        return self._epoch_count

    @property
    def threads(self):
        return self._threads

    def set_epoch_count(self, value):
        try:
            self._epoch_count = int(value)
        except TypeError:
            raise TypeError("epoch_count must be an integer "
                            "in {0} definition".format(self.name))

    def set_threads(self, values):
        try:
            self._threads = []
            for value in values:
                self._threads.append(str(value))
        except ValueError, e:
            LOGR.critical("threads must be an integer in alert" \
            " definition for {0} definition".format(self.name))
            raise

class ReportDefinition(Definition):
    """A Report encapsulates report notification jobs
    """

    def __init__(self, *args, **kwargs):
        """Get an report definition object
        """
        super(ReportDefinition, self).__init__(*args, **kwargs)
        self.set_homogeneity(args[0])
        self.aggregate = ''
        # we use a static viewing window of 2 days
        self.window = 2

    @property
    def homogeneity(self):
        return self._homogeneity

    def set_homogeneity(self, value):
        try:
            self._homogeneity = float(value)
        except ValueError:
            raise ValueError("homogeneity in {0} must be numeric". \
                                format(self.name))
                       
    @property
    def report(self):
        return self.aggregate

class Processor(Thread):
    """A Processor 'processes' a given definition by taking it 
        through a number of predefined handlers. These handlers
        are enumerated in mongoperfmgr.py and implemented here.
        The definition object is initialized with its unique 
        set of handlers.
    """

    def __init__(self, queue, *args, **kwargs):
        Thread.__init__(self)
        self.queue = queue
        self.connection = None
        self.database = None
        self.error = None
        self.tasks = []
        self.date = datetime.utcnow()

    def connect(self):
        """Connect to mongo-perf database
        """
        self.connection = pymongo.MongoClient(
                                host=MONGO_PERF_HOST,
                                port=MONGO_PERF_PORT)
        self.database = self.connection[MP_DB_NAME]

    def run(self):
        """Launch processor from definitions queue.
           Processor is an infinite consumer which 
           runs as long as we have definitions to 
           process in our queue. It is also spawned
           as a daemon thread
        """
        while True:
            try:
                # Will eventually get killed once 
                # parent unblocks - which is when 
                # the last item in self.queue calls
                # the task_done() method
                definition = self.queue.get()
                self.process_definition(definition)
                sleep(1)
            except BaseException, e:
                self.error = format_exc()
                raise
            finally:
                if self.error:
                    LOGR.critical('Error in pipeline for {0}' \
                        .format(definition.name))
                    LOGR.critical('{0}'.format(self.error))
                    
                self.queue.task_done()

    def process_definition(self, definition):
        """Perform each task for given definition
        """
        LOGR.info('Commencing pipeline processing for {0}'. \
                    format(definition.name))
        self.connect()

        for index, stage in enumerate(definition.pipeline):
            LOGR.info('Running {0} for {1}...'. \
                    format(stage, definition.name))
            self.dispatch_handler(stage)(definition)

    def dispatch_handler(self, stage):
        """Call the given handler for this pipeline stage. handlers
            are supplied in each definition's pipeline - we construct
            and return the appropriate function to handle processing 
            given the current stage of processing in the pipeline
        """
        name = '_'.join(stage.split())
        handler = getattr(self, name, None)
        if not handler:
            raise BaseException('No handler defined for {0}'.format(name))
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
                argv = ' '.join(map(str, [start_date, end_date, \
                    label, platform, version, definition.window]))
                analysis = subprocess.Popen(['Rscript', \
                    'mongo-perf.R', start_date, end_date, str(label), \
                    str(platform), str(version), str(definition.window)], \
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                LOGR.info("Started mongo-perf.R with args: {0}".format(argv))
                output, error = analysis.communicate()
                LOGR.info(output)
                if error:
                    raise BaseException('Nonzero exit from mongo-perf.R {0}'. \
                                            format(error))
              

    def pull_results(self, definition):
        """Pull benchmarked results from database
        """
        metrics = self.get_benchmark_metrics(RAW_COLLECTION)
        date = self.date.strftime('%Y-%m-%d')
        for metric in metrics:
            for label in definition.labels:
                platform = self.get_platform(RAW_COLLECTION, label)
                if not platform:
                    raise BaseException("Label {0} not found".format(label))
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
                LOGR.critical("No data for {0}".format(task_key))
            for data in cursor:
                results = data['result']
                res_map = defaultdict(list)
                for result in results:
                    # only report anomalies on key_date
                    if result['run_date'] == key_date:
                        res_map[result['test']].append(result)
                for test in res_map:
                    # 'AV' measures the linearity of
                    # a window of three data points  
                    # 'test.AV' measures the probability
                    # of there being an outlier in the window
                    data_points = sorted(res_map[test], 
                    key=lambda k : (abs(k['AV'])), reverse=True)
                    for dp in data_points:
                        if dp['test_AV'] > definition.threshold:
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
            values['anomalies'] = ''

            for test in definition.result[top_level]:
                anomaly_list = []
                anomalies = definition.result[top_level][test]

                for anomaly in anomalies:
                    thread = anomaly['thread_count']
                    # can't have an anomaly here
                    if thread == '1' and values['metric'] == 'speedup':
                        continue

                    target_trend = 'decreasing'
                    if anomaly['y3'] > anomaly['y2']:
                        target_trend = 'increasing'
                        if anomaly['AV'] < 0: 
                            target_trend = 'picking up'
                    else:
                        if anomaly['AV'] > 0:
                            target_trend = 'declining'

                    homogeneity = (100 - anomaly['madindex_AV'])
                    series_trend = "homogenous"
                    if homogeneity < definition.homogeneity:
                        homogeneity = "{0:.2f}%".format(abs(homogeneity))
                        anomaly_url = "<a href=\"http://{0}/results?metric={1}&" \
                                "labels={2}&platforms={3}&versions={4}&dates={5}" \
                                "#{6}\">{6}</a>".format(MONGO_PERF_HOST, keys[0], \
                                keys[1], keys[2], keys[3], window, test)
                        anomaly_str = anomaly_url + " might be {0} in performance " \
                                "- see thread {1} (trends {2} at {3})".format \
                                (target_trend, thread, series_trend, homogeneity)
                        anomaly_list.append(anomaly_str)
            
                if anomaly_list:
                    values['anomalies'] += '<br>'
                    values['anomalies'] += '<br>'.join(anomaly_list)

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
            definition.recipients, format="html")
        else:
            message = NO_REPORT_INFO_HEADER.substitute({'date' : date})
            conn = connect_ses().send_email(
            "mongo-perf admin <wisdom@10gen.com>",
            "MongoDB Performance Report", message, 
            definition.recipients, format="html")

    def show_report(self, definition):
        """Shows report in browser
        """
        date = self.date.strftime('%Y-%m-%d')
        if definition.report:
            header = REPORT_INFO_HEADER.substitute({ "date" : date })
            message = header + definition.report
        else:
            message = NO_REPORT_INFO_HEADER.substitute({'date' : date})

        fileObj = '.report.html'
        path = abspath(join(realpath( __file__ ), '..', fileObj))
        
        with open(path, 'w') as f:
            f.write(message)

        if platform=='win32':
            subprocess.Popen(['start', path], shell= True)
        elif platform=='darwin':
            subprocess.Popen(['open', path])
        else:
            try:
                subprocess.Popen(['xdg-open', path])
            except OSError:
                raise



    """Alert pipeline stage handlers below."""


    def pull_data(self, definition):
        """Load the given alert into processor's data
        """
        count = definition.epoch_count
        skip = 1

        if definition.epoch_type == 'daily':
            skip = 1
        elif definition.epoch_type == 'weekly':
            skip = 7
        elif definition.epoch_type == 'monthly':
            skip = 30
        else:
            LOGR.info('Unrecognized epoch_type: {0} \
                     defaulting to daily'.format(definition.epoch_type))

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
            # Not yet imploemented
            result = None
        else:
            raise BaseException("Transform: {0} not recognized.".format(transform))
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
            record = self.database[RAW_COLLECTION].find_one \
            ({'benchmarks.name' :{'$regex': operation, '$options' : 'i'}}, \
            {'benchmarks.name' : 1, '_id' : 0 })
            if record:
                for op in record['benchmarks']:
                    ops.add(op['name'])
        return ops

    def get_keys(collection, key):
        """Get all distinct values of the given key
        """
        return sorted(self.database[collection].distinct(key), \
                        reverse=True)

    def get_benchmark_metrics(self, collection):
        """Get all benchmark metrics we have in database. 
            This finds any benchmark result in the RAW_COLLECTION 
            and pulls out the associated metrics stored for the result.
            We assume the metrics stored will be uniform across records.

            The returned value is a list that looks like: ['ops_per_sec',
            'speedup', 'time']
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
            results = record['results']
            for thread in results:
                if thread in definition.threads:
                    parse[definition.metric][thread].\
                    append(results[thread][definition.metric])

        return dates, parse
        
