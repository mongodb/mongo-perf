# mongo-perf
This is a benchmark script for the MongoDB server.

### Overview
============
This repo contains scripts to run benchmark tests for mongodb. It also includes some scripts that perform anomaly detection (herein called analysis) and reporting on historical benchmark tests. See `Usage` for more information.


### Dependencies
================
##### Benchmarks
* Scons
* Python >= 2.5
* pymongo
* MongoDB
* git (optional)
* C++ build environment
* Boost C++ Libraries

##### Analysis
* Python >= 2.5
* pymongo
* MongoDB
* R >= 2.15.0
* rmongodb

##### Reporting
* boto (optional)
* Amazon SES® (optional) 

### Local Usage
---------------
##### Benchmarks
<pre><code># compile the C++ driver
cd mongo-cxx-driver && scons 
# compile the benchmark script
scons benchmark 

To run on an already existing mongod:

	(start mongod on 27017 to test against and record 
	the results into)

	# this runs the tests and records the results
	# optionally supply a label as well using -l
	python runner.py --nolaunch -l HOSTNAME

To run it against the source on github:
	
	# this pulls and starts mongod from the github repo,
	# runs the tests and records the results
	# optionally supply a label as well using -l
	python runner.py --local -l HOSTNAME

# this serves the results on port 8080
python server.py 

Go to http://localhost:8080 to see the results
</code></pre>

##### Analysis

Use `alerting.ini` and `reporting.ini` as a starting point to describe the kinds of alerts or reports you want generated. The sample files have only one entry but you can define as many alerts/reports as you like.

`analysismgr.py` defines pipelines &mdash; ALERT_TASKS and REPORT_TASKS &mdash; which control the flow of data processing. Definition parameters for alerts/reports are described in `alert_definitions.ini` and `report_definitions.ini` respectively &ndash; you can define as many as you wish. **All fields enumerated and documented in the sample '.ini' files are required**.

*Note that you need at least three days' worth of data to run* `analysismgr.py`.
<pre><code># this runs the whole pipeline of analysis and reporting
python analysismgr.py</code></pre>
Logs are written to stdout and `mongo-perf-log.txt` when you run `analysismgr.py`

##### Reporting
The default pipeline for both alerts and reports (as listed in ALERT_TASKS and REPORT_TASKS in `analysismgr.py`) show the result of the alerts/reports processing using your default web browser.

If you wish to receive email reports, change the last stage in pipeline in `analysismgr.py` to 'send reports' for reports, and 'send alerts' for alerts. Emails are sent using Amazon SES® so you will need an account on that to send reports (be sure to have your `aws_access_key_id` and `aws_secret_access_key` under `[Credentials]` in /etc/boto.cfg).

*By default, all analysis/reporting run against a `mongod` on port `27017` (mongod must be running on this port). To specify a different host, change* MONGO_PERF_HOST *and* MONGO_PERF_PORT *in `analysismgr.py`,`jobsmgr.py` and `mongo-perf.R`.*

#### Buildbot Usage
-------------------
##### Benchmarks
A call to this script by a buildslave might be:
<pre><code>python runner.py --rhost localhost --rport 27017 --port 30000  --mongod MONGO_DIR/mongod  --label Linux_64-bit
</code></pre>
The snippet above starts `mongod` on port 30000 (which it tests against) and writes the result of the benchmark tests to `localhost` on port `27017`. You can have both `--port` and `--rport` be the same.

If running benchmarks on a buildslave and analysis as a cron job, ensure that you call analysis only _after_ the benchmark tests have been completed.

*Analysis and Reporting work the same way as on local machines*.