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
* boto
* Amazon SES account
<hr>

To run benchmarks locally with mongod:
<pre><code># compile the C++ driver
cd mongo-cxx-driver && scons 
# compile the benchmark script
scons benchmark 

(start a mongod on 27017 to test against and record the results into)

# this runs the tests and records the results
# optionally supply a label as well using -l
python local.py --nolaunch -l MY_HOSTNAME
# this serves the results
python server.py 

Go to http://localhost:8080 to see the results
</code></pre>

To run analysis:

Use alerting.ini and reporting.ini as a starting point to describe the kinds of alerts or reports you would like to receive. 

<pre><code>(after adjusting the parameters in 'alerting.ini' and/or 'reporting.ini' accordingly)

# this runs the whole pipeline of analysis and reporting
python analysismgr.py

(note that you need at least three days' worth of data to run analysis)
</code></pre>

The default pipeline for both alerts and reports send reports using Amazon SES ® so you will need an account on that to email reports. If you are unable to use this, change the last stage in pipeline in `analysismgr.py` to 'send report' instead of 'show report'.


