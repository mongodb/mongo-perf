# Copyright 2013 10gen, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on a1n "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Driver for processing and analysis of benchmarked data."""

import pymongo
from os import path
from sys import exit
from opsmgr import *
from time import sleep
import logging as logr
import logging.handlers
from datetime import datetime
from Queue import Queue, Empty
from ConfigParser import SafeConfigParser

# Set up logging
LOGR = logr.getLogger('mongo-perf-alerting')

# Global variables
ALERT_DEFINITIONS = 'alert_definitions.ini'
REPORT_DEFINITIONS = 'report_definitions.ini'

ALERTS_COLLECTION = "alertDefinition"
REPORTS_COLLECTION = "reportDefinition"
ALERT_HISTORY_COLLECTION = "alertHistory"

# pipeline to be used for alerts
ALERT_TASKS = ['pull data', 'process alerts', \
                'persist results']

# pipeline to be used for reports
REPORT_TASKS = ['process benchmarks', 'pull results', 
                'analyze results', 'prepare report', 'send report']

# db globals
MONGO_PERF_HOST = "localhost"
MONGO_PERF_PORT = 27017
CONNECTION = pymongo.Connection(host=MONGO_PERF_HOST,
                                port=MONGO_PERF_PORT)
DATABASE = CONNECTION.bench_results
DATE = datetime.now().strftime('%Y-%m-%d')

def main():
    """Program entry point
    """
    configureLogger('mongo-perf-log.txt')
    ensure_indexes()
    
    ensure_definition(ALERT_DEFINITIONS, "alert")
    alerts = pull_definitions("alert")
    start_definition_processing(alerts)

    ensure_definition(REPORT_DEFINITIONS, "report")
    reports = pull_definitions("report")
    start_definition_processing(reports)

def pull_definitions(definition_type):
    """Pull all alerts that need to be processed
    """
    if definition_type == 'alert':
        collection = 'alertDefinition'
    elif definition_type == 'report':
        collection = 'reportDefinition'

    cursor = DATABASE[collection].find()
    definitions = []
    LOGR.info("Reconstructing jobs from db")

    for params in cursor:
        params['type'] = definition_type
        definitions.append(params)

    LOGR.info("Successfully pulled all {0} definitions".\
        format(definition_type))

    return definitions

def start_definition_processing(definitions):
    """Prepare definitions to be processed and
        put them in a procesing queue
    """
    definitions_processing_queue = Queue()
    daemons = []

    for i in range(len(definitions)):
        daemon = Processor(definitions_processing_queue)
        daemon.daemon = True
        daemon.start()
        daemons.append(daemon)

    LOGR.info("Spawned {0} daemon(s)".format(len(definitions)))
    definitions_list = [definition for definition in definitions]
    
    while definitions_list:
        for params in definitions_list:
            if params['type'] == 'alert':
                params['pipeline'] = ALERT_TASKS
                definition = AlertDefinition(params)
            elif params['type'] == 'report':
                params['pipeline'] = REPORT_TASKS
                definition = ReportDefinition(params)
            if definition.state == 'not started':
                LOGR.info('Fired up {0} processor. {1} ' \
                'definitions(s) left;'\
                .format(definition.name, len(definitions_list) - 1))
                definitions_processing_queue.put(definition)
                definitions_list.remove(params)
            elif definition.state == 'running':
                LOGR.info('Running {0} ({1}). {2} job(s) left;' \
                .format(definition.name, definition.state, \
                len(definitions_list)))
            if len(definitions_list) == 0:
                LOGR.info('Started all {0} definition '\
                    'processing jobs!'.format(params['type']))
    
    definitions_processing_queue.join()
    # avoid weird thread error
    sleep(1)
    LOGR.info("Finished processing all definitions")

def configureLogger(logFile):
    """Configures LOGR to send messages to stdout and LOGR file
    """
    logFile = path.abspath(logFile)
    logHdlr = logr.handlers.RotatingFileHandler(logFile,
                maxBytes=(100 * 1024 ** 2), backupCount=1)
    stdoutHdlr = logr.StreamHandler()
    formatter = logr.Formatter('%(asctime)s %(levelname)s %(message)s')
    logHdlr.setFormatter(formatter)
    stdoutHdlr.setFormatter(formatter)
    LOGR.addHandler(logHdlr)
    LOGR.addHandler(stdoutHdlr)
    LOGR.setLevel(logr.INFO)
    LOGR.info("Saving logs to {0}".format(logFile))

def ensure_indexes():
    """Ensure we have all indexes we need for accessing data
    """
    DATABASE[ALERTS_COLLECTION].ensure_index \
    ([('name', pymongo.ASCENDING)]
    , unique=True)

    DATABASE[REPORTS_COLLECTION].ensure_index \
    ([('name', pymongo.ASCENDING)]
    , unique=True)

    DATABASE[ALERT_HISTORY_COLLECTION].ensure_index \
    ([('test', pymongo.ASCENDING)
    , ('label', pymongo.ASCENDING)
    , ('platform', pymongo.ASCENDING)
    , ('transform', pymongo.ASCENDING)
    , ('alert_name', pymongo.ASCENDING)
    , ('trigger_date', pymongo.ASCENDING)
    , ('thread_count', pymongo.ASCENDING)]
    , unique=True)
       
def ensure_definition(definition, definition_type):
    """Load all alerts/reports into DATABASE
    """ 
    parser = SafeConfigParser()
    parser.optionxform = str
    parser.read(definition)

    if definition_type == 'alert':
        collection = ALERTS_COLLECTION
    elif definition_type == 'report':
        collection = REPORTS_COLLECTION

    for section in parser.sections():
        params = {}
        params['name'] = section
        for name, value in parser.items(section):
            value = value.split(', ')
            if name[0] == '~':
                params[name[1:]] = value[0]
            else:
                params[name] = value
        DATABASE[collection].update({'name' : section}, \
                                params, upsert=True)
        LOGR.info("Ensured {0} definition for {1}".\
        format(definition_type, section))

if __name__ == '__main__':
    main()

