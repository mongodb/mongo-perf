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

import re
import logging
import pymongo
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
Here are the reports generated on $date for $name:
<br><br>
''')

NO_REPORT_INFO_HEADER = Template('''Dear User,
<br><br>
Metrics seem be be performing fine on $date for $name!
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
ALERT_INFO = Template('''Dear User,
<br><br>
Here are the alerts generated on $date for $name:
<br><br>$header<br>$alerts<br><br>
''')

NO_ALERT_INFO_HEADER = Template('''Dear User,
<br><br>
No alerts generated on $date for $name!
<br><br>
''')


class Definition(object):
    """A Definition encapsulates information pertaining to
        the alerts and reports
    """
    def __init__(self, *args, **kwargs):
        """ Get a definition given parameters.

        """
        self.aggregate = ''
        self.state = 'not started'
        self.name = kwargs.get('name', '')
        self.type = kwargs.get('type', '')
        self.labels = kwargs.get('labels', '')
        self.multidb = kwargs.get('multidb', '')
        self.versions = kwargs.get('versions', '')
        self.operations = kwargs.get('operations', '')
        self.recipients = kwargs.get('recipients', '')
        self.metric = kwargs.get('metric', 'ops_per_sec')
        self.pipeline = kwargs.get('pipeline', None)
        self._result = defaultdict(lambda: defaultdict(list))

        try:
            self.threshold = float(kwargs.get('threshold'))
        except TypeError:
            raise TypeError("threshold must be an numeric "
                            "in {0} definition".format(self.name))

    @property
    def result(self):
        return self._result

    @property
    def report(self):
        return self.aggregate

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
        self.skip = 1
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
            LOGR.critical("threads must be an integer in alert"
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
        # we use a static viewing window of 2 days
        self.window = 2

    @property
    def homogeneity(self):
        return self._homogeneity

    def set_homogeneity(self, value):
        try:
            self._homogeneity = float(value)
        except ValueError:
            raise ValueError("homogeneity in {0} must be numeric".
                             format(self.name))


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
                    LOGR.critical('Error in pipeline for {0}'
                        .format(definition.name))
                    LOGR.critical('{0}'.format(self.error))

                self.queue.task_done()

    def process_definition(self, definition):
        """Perform each task for given definition
        """
        LOGR.info('Commencing pipeline processing for {0}'.
                  format(definition.name))
        self.connect()

        for index, stage in enumerate(definition.pipeline):
            LOGR.info('Running {0} for {1}...'.
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
            mongo-perf.R pulls the raw benchmarked data, analyses
            it, and writes the analyses results back in the database
        """
        start_date = self.date - timedelta(days=definition.window)
        start_date, end_date = map(lambda d:
                                   d.strftime('%Y-%m-%d'), [start_date, self.date])

        for label in definition.labels:
            platform = self.get_platform(RAW_COLLECTION, label)
            for version in definition.versions:
                argv = ' '.join(map(str, [start_date, end_date, label, platform, 
                                          version, definition.window, definition.multidb]))
                analysis = subprocess.Popen(['Rscript', 'mongo-perf.R', start_date, end_date, 
                                                str(label), str(platform), str(version), 
                                                str(definition.window), str(definition.multidb)],
                                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                LOGR.info("Started mongo-perf.R with args: {0}".format(argv))
                output, error = analysis.communicate()
                LOGR.info(output)
                if error:
                    raise BaseException('Nonzero exit from mongo-perf.R {0}'.
                                        format(error))

    def pull_results(self, definition):
        """Pull benchmarked results from database
        """
        num_db = 'singledb' if definition.multidb == '0' else 'multidb'
        metrics = self.get_benchmark_metrics(num_db)
        date = self.date.strftime('%Y-%m-%d')
        for metric in metrics:
            for label in definition.labels:
                platform = self.get_platform(RAW_COLLECTION, label)
                if not platform:
                    raise BaseException("Label {0} not found".format(label))
                for version in definition.versions:
                    cursor = self.database['analysis'].find({"label": label,
                                                            "version": version,
                                                            "date": date,
                                                            "metric": metric,
                                                            "platform": platform})
                    job_str = ';'.join(map(str, [metric, label, platform, version]))
                    job_hash = md5(job_str).hexdigest()
                    self.tasks.append({job_str: cursor})

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
                    # 'test_AV' measures the probability
                    # of there being an outlier in the window
                    data_points = sorted(res_map[test],
                                         key=lambda k: (abs(k['AV'])), reverse=True)
                    for dp in data_points:
                        if dp['test_AV'] > definition.threshold:
                            definition.result[task_key][test].append(dp)

    def prepare_report(self, definition):
        """Prepare report based on analyzed data
        """
        window = '+'.join(self.get_window(self.date, definition.window, 1))
        num_db = 'singledb' if definition.multidb == '0' else 'multidb'
        operations = self.find_operations(definition.operations, num_db)
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
                    if anomaly['test'] in operations:
                        thread = anomaly['thread_count']
                        # can't have an anomaly here
                        if thread == '1' and values['metric'] == 'speedup':
                            continue

                        target_trend = 'decreasing'
                        # y1, y2, y3 are in the window we're considering
                        if anomaly['y3'] > anomaly['y2']:
                            target_trend = 'increasing'
                            if anomaly['AV'] < 0:
                                target_trend = 'picking up'
                        else:
                            if anomaly['AV'] > 0:
                                target_trend = 'declining'

                        # madindex_AV is a measure of homogeneity
                        # really high values are bad for anomaly detection
                        homogeneity = (100 - anomaly['madindex_AV'])
                        series_trend = "homogenous"
                        if homogeneity < definition.homogeneity:
                            homogeneity = "{0:.2f}%".format(abs(homogeneity))
                            anomaly_url = "<a href=\"http://{host}/results?" \
                                "metric={metric}&labels={labels}&platforms={platforms}&" \
                                "versions={versions}&dates={dates}#{test}\" target=\"_blank\">" \
                                "{test}</a>".format(host=MONGO_PERF_HOST, test=test, metric=keys[0], \
                                labels=keys[1], platforms=keys[2], versions=keys[3], dates=window)
                            anomaly_str = anomaly_url + " might be {0} in performance " \
                                "- see thread {1} (trends {2} at {3})".format \
                                (target_trend, thread,
                                series_trend, homogeneity)
                            anomaly_list.append(anomaly_str)

                if anomaly_list:
                    values['anomalies'] += '<br>'
                    values['anomalies'] += '<br>'.join(anomaly_list)

            if values['anomalies']:
                definition.aggregate += REPORT_BODY.substitute(values)

    def send_reports(self, definition):
        """Sends reports based on generated report
        """
        current_date = self.date.strftime('%Y-%m-%d')
        from boto import connect_ses

        if definition.report:
            header = REPORT_INFO_HEADER.substitute(
                {"date": current_date, "name": definition.name})
            message = header + definition.report
            conn = connect_ses().send_email(
                "mongo-perf admin <mongoperf@10gen.com>",
                "MongoDB Performance Report", message,
                definition.recipients, format="html")
        else:
            message = NO_REPORT_INFO_HEADER.substitute(
                {"date": current_date, "name": definition.name})
            conn = connect_ses().send_email(
                "mongo-perf admin <mongoperf@10gen.com>",
                "MongoDB Performance Report", message,
                definition.recipients, format="html")

    def show_results(self, definition):
        """Shows alerts/report in browser
        """
        current_date = self.date.strftime('%Y-%m-%d')

        if definition.type == 'alert':
            delta = timedelta(days=definition.skip * definition.epoch_count)
            start_date = (self.date - delta).strftime('%Y-%m-%d')
            if not definition.report:
                message = NO_ALERT_INFO_HEADER.substitute(
                    {"date": current_date, "name": definition.name})
            else:
                epoch_type = self.get_epoch_type(definition)
                header_str = "\"{0}\" from {1} to {2} ({3} {4}) for:". \
                    format(definition.transform, start_date, current_date,
                           definition.epoch_count, epoch_type)
                message = ALERT_INFO.substitute(
                    {"date": current_date, "name": definition.name,
                     "header": header_str, "alerts": definition.report})
        else:
            if not definition.report:
                message = NO_REPORT_INFO_HEADER.substitute(
                    {"date": current_date, "name": definition.name})
            else:
                header = REPORT_INFO_HEADER.substitute(
                    {"date": current_date, "name": definition.name})
                message = header + definition.report

        file_obj = '.{0}.html'.format(definition.type)
        path = abspath(join(realpath(__file__), '..', file_obj))

        with open(path, 'w') as f:
            f.write(message)

        if platform == 'win32':
            subprocess.Popen(['start', path], shell=True)
        elif platform == 'darwin':
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

        if definition.epoch_type == 'daily':
            definition.skip = 1
        elif definition.epoch_type == 'weekly':
            definition.skip = 7
        elif definition.epoch_type == 'monthly':
            definition.skip = 30
        else:
            LOGR.info('Unrecognized epoch_type: {0} \
                     defaulting to daily'.format(definition.epoch_type))

        window = self.get_window(self.date, count, definition.skip)

        for label in definition.labels:
            platform = self.get_platform(RAW_COLLECTION, label)
            for version in definition.versions:
                cursor = self.database[RAW_COLLECTION].find({
                    'label': label,
                    'run_date': {'$in': window},
                    'version': version})

                task = ','.join(map(str, (label, platform, version)))
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
                for test in data:
                    for thread in definition.threads:
                        thread_data = data[test][definition.metric][thread]
                        if len(thread_data) > 1:
                            value = self.transform_helper(definition.transform,
                                                          thread_data, current_index)
                            alert = {}
                            alert['label'], alert['platform'], \
                                alert['version'] = task.split(',')
                            alert['transform'] = definition.transform
                            alert['alert_name'] = definition.name
                            alert['thread_count'] = thread
                            alert['trigger_date'] = date
                            alert['test'] = test
                            alert['value'] = value
                            definition.alerts[index] = alert
                            index += 1

    def persist_alerts(self, definition):
        """Store triggered alerts
        """
        for index in definition.alerts:
            alert = definition.alerts[index]
            if self.passes_threshold(definition, alert):
                self.database[ALERT_HISTORY_COLLECTION].update({
                    'test': alert['test'],
                    'label': alert['label'],
                    'platform': alert['platform'],
                    'transform': alert['transform'],
                    'version': alert['version'],
                    'alert_name': alert['alert_name'],
                    'trigger_date': alert['trigger_date'],
                    'thread_count': alert['thread_count']},
                    alert, upsert=True)

    def prepare_alerts(self, definition):
        """Formats alerts to be sent/shown
        """
        epoch_type = self.get_epoch_type(definition)
        window = '+'.join(self.get_window(self.date, 
                                        definition.epoch_count, 1))

        for index in definition.alerts:
            alert = definition.alerts[index]
            if self.passes_threshold(definition, alert):
                alert_url = "<a href=\"http://{host}/results?" \
                            "metric={metric}&labels={labels}&" \
                            "platforms={platforms}&versions="  \
                            "{versions}&dates={dates}#{test} " \
                            "\"target=\"_blank\">{test}</a>". \
                            format(host=MONGO_PERF_HOST, metric=definition.metric, \
                            labels=alert['label'], platforms=alert['platform'], \
                            versions=alert['version'], dates=window, test=alert['test'])

                definition.aggregate += "- {alert} on ({label}, {version}, thread " \
                    "{thread_count}) is {value:.1f} ({comparator} {threshold})<br>". \
                    format(alert=alert_url, label=alert['label'], version=alert['version'], 
                            thread_count=alert['thread_count'], value=alert['value'],
                            comparator=definition.comparator, threshold=definition.threshold)

    def send_alerts(self, definition):
        """Sends alert to the definition's recipients
        """
        current_date = self.date.strftime('%Y-%m-%d')
        delta = timedelta(days=definition.skip * definition.epoch_count)
        start_date = (self.date - delta).strftime('%Y-%m-%d')
        from boto import connect_ses

        if definition.type == 'alert':
            if not definition.report:
                message = NO_ALERT_INFO_HEADER.substitute(
                    {"date": current_date, "name": definition.name})
            else:
                epoch_type = self.get_epoch_type(definition)
                header_str = "\"{transform}\" from {start_date} to {end_date} " \
                             "({count} {epoch}) for:".format(transform=definition.transform, 
                                start_date=start_date, end_date=current_date,
                                count=definition.epoch_count, epoch=epoch_type)
                message = ALERT_INFO.substitute(
                    {"date": current_date, "name": definition.name,
                     "header": header_str, "alerts": definition.report})
        else:
            if not definition.report:
                message = NO_REPORT_INFO_HEADER.substitute({'date': current_date})
            else:
                header = REPORT_INFO_HEADER.substitute({"date": current_date})
                message = header + definition.report

        conn = connect_ses().send_email(
            "mongo-perf admin <mongoperf@10gen.com>",
            "MongoDB Performance Report", message,
            definition.recipients, format="html")

    """General helper methods below."""

    def find_operations(self, operations, num_db):
        """Get all tests that match any of the operations
        """
        ops = set()
        record = self.database[RAW_COLLECTION].find_one()
        if record:
            for operation in operations:
                for op in record[num_db]:
                    regexed = re.compile(operation, re.IGNORECASE)
                    if regexed.match(op['name']):
                        ops.add(op['name'])
        return ops

    def get_keys(collection, key):
        """Get all distinct values of the given key
        """
        return sorted(self.database[collection].distinct(key), reverse=True)

    def get_benchmark_metrics(self, num_db):
        """Get all benchmark metrics we have in database.
            This finds any benchmark result in the RAW_COLLECTION
            and pulls out the associated metrics stored for the result.
            We assume the metrics stored will be uniform across records.

            The returned value is a list that looks like: ['ops_per_sec',
            'speedup', 'time']
        """
        return self.database[RAW_COLLECTION].find_one()\
                [num_db][0]['results'].itervalues().next().keys()

    def get_epoch_type(self, definition):
        """Returns a reformatted epoch_type string
        """
        if definition.epoch_type == 'daily':
            if definition.epoch_count > 1:
                return 'days'
            return 'day'
        elif definition.epoch_type == 'weekly':
            if definition.epoch_count > 1:
                return 'weeks'
            return 'week'
        elif definition.epoch_type == 'monthly':
            if definition.epoch_count > 1:
                return 'months'
            return 'month'
        return ''

    def get_platform(self, collection, label):
        """Get platform name given label
        """
        record = self.database[collection].find_one({'label': label})
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
        parse = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        num_db = 'singledb' if definition.multidb == '0' else 'multidb'
        operations = self.find_operations(definition.operations, num_db)
        dates = []
        for record in cursor:
            dates.append(record['run_date'])
            for test in record[num_db]:
                if test['name'] in operations:
                    results = test['results']
                    for thread in results:
                        if thread in definition.threads:
                            parse[test['name']][definition.metric][thread].\
                                append(results[thread][definition.metric])

        return dates, parse

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

    def transform_helper(self, transform, data, current_index):
        """Performs the given transformation on data passed in
        """
        result = ''
        if transform == 'std_dev':
            mean = sum(data) / len(data)
            result = sqrt(sum((point - mean) ** 2
                              for point in data) / (len(data) - 1))
        elif transform == 'mean':
            result = sum(data) / len(data)
        elif transform == 'actual':
            result = data[current_index]
        elif transform == 'fourier':
            # Not yet implemented
            result = None
        else:
            raise BaseException(
                "Transform: {0} not recognized.".format(transform))
        return result
