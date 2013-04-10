# mongo-perf
This is a benchmark script for the MongoDB server.

### Dependencies:
##### Benchmarking
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
* Amazon SES account (optional)

<hr>

### Usage (on local machine)
##### Benchmarking
To run benchmark tests locally, use the `local.py` script.
<pre><code># compile the C++ driver
cd mongo-cxx-driver && scons 
# compile the benchmark script
scons benchmark 

To run on an already existing mongod:

	(start mongod on 27017 to test against and record 
	the results into)

	# this runs the tests and records the results
	# optionally supply a label as well using -l
	python local.py --nolaunch -l HOSTNAME

To run it against the source on github:
	
	# this pulls and starts mongod from the github repo,
	# runs the tests and records the results
	# optionally supply a label as well using -l
	python local.py -l HOSTNAME

# this serves the results on port 80
# sudo if you're not root
python server.py 

Go to http://localhost to see the results
</code></pre>

##### Analysis

Use `alerting.ini` and `reporting.ini` as a starting point to describe the kinds of alerts or reports you want generated. The sample files have only one entry but you can define as many alerts/report as you like.

`analysismgr.py` defines pipelines &mdash; ALERT_TASKS and REPORT_TASKS &mdash; which control the flow of data processing. Definitions for alerts/reports are described in `alert_definitions.ini` and `report_definitions.ini` - you can define as many alerts/reports as you wish. **All fields described and enumerated in the sample '.ini' files are required**.

*Note that you need at least three days' worth of data to run* `analysismgr.py`.
<pre><code># this runs the whole pipeline of analysis and reporting
python analysismgr.py</code></pre>
Logs are written to stdout and `mongo-perf-log.txt` when you run `analysismgr.py`

##### Reporting
The default pipeline for both alerts and reports (as listed in ALERT_TASKS and REPORT_TASKS) show the result of the alerts/reports processing using your default web browser.

If you wish to receive email reports, change the last stage in pipeline in `analysismgr.py` to 'show report' for reports, and 'send alerts' for alerts. By default, emails are sent using Amazon SES® so you will need an account on that to send email reports.

*By default, all analysis/reporting on on your local machine against a `mongod` on port `27017` (so you should have `mongod` running on this port). If you wish to specify a different host, change* MONGO_PERF_HOST *and* MONGO_PERF_PORT *in `analysismgr.py`, `mongo-perf.R` and `jobsmgr.py`.*

### Usage (via buildbdot)
##### Benchmarking
To run benchmark tests locally, use the `runner.py` script.
A call made to this script by the buildslave might be:`.
<pre><code>python runner.py --rhost localhost --rport 27017 --port 30000  --mongod MONGO_DIR/mongod  --label Linux_64-bit
</code></pre>
The snippet above starts `mongod` on port 30000 (which it tests against) and writes the result of the benchmark tests to `localhost` on port `27017`. You can have both `--port` and `--rport` be the same.

*Analysis and Reporting work the same way as on local machines*.