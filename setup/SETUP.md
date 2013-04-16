# Mongo-perf Test/QA

Mongo-perf is comprised of two broad and complementary parts:

- Operations - this can be integrated (optionally) as part of buildbot and is responsible for running benchmark tests
- Analysis/Reporting - this runs analysis on benchmarked data and reports on any anomalies detected in the most recent benchmark tests.

This documentation will cover how to setup and test both parts of the system.

##Setup

### Mongo-perf Operations
=========================

The operations side of mongo-perf could either be setup as part of buildbot or could be run on a local machine (this is much easier). We will cover how to setup the operation side using either of these.

These are all the packages you need installed. You can install these as one after the other &ndash; as required &ndash; as done in the steps provided below, or all at once using a script (don't forget the -y flag). We recommend going step by step though; in case some issues crop up.
<pre><code>sudo apt-get update # update sources
sudo apt-get install python-setuptools # install setup tools
sudo apt-get install gcc # install gcc
sudo apt-get install python-dev # install python dev pacakges
sudo easy_install buildbot # install buildbot
buildbot create-master master # create a buildbot master
buildbot start master # start the master
sudo easy_install buildbot-slave # install a buildbot slave
buildslave create-slave slave localhost:9989 mongoperf zxcasd # start the slave
sudo apt-get install git-core # install git
sudo apt-get install scons # install scons
sudo apt-get install build-essential # install build-essential
sudo apt-get install libboost-all-dev # install boost libraries
sudo easy_install pymongo # install pymongo
</code></pre>

##### Mongo-perf Operations on Buildbot
=========================
- Launch a new AMI image (This was tested on a 64-bit Ubuntu 12.04 t1.micro instance: hereinafter referred to as `AMI_INSTANCE_HOST`).
- Add rules to allow for the following inbound ports
	- 22 (SSH)
	- 80 (HTTP)
	- 8010 (Buildbot)
	- 9989 (Buildbot)
	- 27017 (mongodb)<br>
	(or you can just use the `benchmarking` security group in `AWS_TEST` &ndash; if it still exists)
- Ensure you have `python 2.7.X (X >= 2)` installed
- Download package lists from the repositories: `sudo apt-get update`
- Install easy_install: `sudo apt-get install python-setuptools`
- Install gcc: `sudo apt-get install gcc`
- Install python-dev: `sudo apt-get install python-dev`
- Install buildbot: `sudo easy_install buildbot`
- Create a buildbot master: `buildbot create-master master`
(if you get an error like: `from sqlalchemy import exceptions as sa_exceptions ImportError: cannot import name exceptions` you need to change the import statement in the referenced file to `from sqlalchemy import exc as sa_exceptions` &ndash; sqlalchemy has some issues)
- Change line `754` in the supplied `master.cfg` to your email address so you can receive notifications on how the build process performed
- Change line `561` in the same file to point to the `AWS_INSTANCE_HOST` you have set up
- Now put `master.cfg` under the buildbot master directory you created
- Start the buildbot master: `buildbot start master`
- Navigate to `AMI_INSTANCE_HOST:8010` to view your new buildbot

The supplied buildbot config contains a triggered scheduler which allows you to run mongo-perf anytime you want. It also contains a nightly scheduler that pulls and runs mongo-perf every night. 

If you navigate to `Builders >> Linux 64-bit`, you'll notice that our buildslave, `mongoperf`, is shown to be offline. We need to get our slaves working!

So let's start up our slave. To do this, run the following:

- Install the buildbot-slave: `sudo easy_install buildbot-slave`
- Create the buildbot slave: `buildslave create-slave slave localhost:9989 mongoperf zxcasd` (this username/password combination is the same as that used in the supplied `master.cfg` file).
- Start the buildslave: `buildslave start slave`
- If you navigate back to `Builders >> Linux 64-bit`, you should see that the slave is now listed as `connected`.


Now you've set up both a buildbot master alongside an accompanying slave. You'll notice in the buildbot master configuration that code to pull in mongo (from lines `160` onwards) has been commented out &ndash; along with a slew of tests. This takes quite a bit of time so to make this easier, you can just download the appropriate `mongod` executable from `http://www.mongodb.org/downloads` and put it in:
`~/slave/Linux_64bit/mongo/` (you have to create the mongo directory yourself).

As at the time of this writing, the most recent version of `mongod` is 2.4.1.
<pre><code>wget http://fastdl.mongodb.org/linux/mongodb-linux-x86_64-2.4.1.tgz
tar xvzf mongodb-linux-x86_64-2.4.1.tgz
mv mongodb-linux-x86_64-2.4.1/bin/- ~/slave/Linux_64bit/mongo/
</code></pre>

Note that in production, mongodb is pulled from github and compiled on the buildslave into this directory. We only download it here for expediency &ndash; the effects are the same. Now that we have mongodb where we want it, we can go ahead and install other applications that we need to run mongo-perf successfully:

- Install git: `sudo apt-get install git-core`
- Install scons: `sudo apt-get install scons`
- Install build-essential: `sudo apt-get install build-essential`
- Install boost libraries: `sudo apt-get install libboost-all-dev`
- Install pymongo: `sudo easy_install pymongo`

Now you're all set to run your first triggered build! Navigate to `AMI_INSTANCE_HOST:8010`, `Builders >> Linux 64-bit`, and click the `Force Build` button. This will start a new build for mongo-perf. Now click on its build #, under `Current Builds`, to follow its progress. The build does a number of things:

- It clones the mongo-perf repo
- It compiles the mongo-cxx-driver
- It compiles mongo-perf 
- It runs the benchmark tests
- It writes the results to a database

*`Note that this might take over an hour for this to complete - depending on your hardware - which is why you're using email notifications`*<br>

By default, mongo-perf will write its benchmark test results to the host pointed to at line `561` (which should now be your `AWS_INSTANCE_HOST`) on the port pointed to at line `562` (in `master.cfg`) so you should ensure that you have a `mongod` running on that port to accept the results e.g. `mongod --fork --syslog` &ndash; note that we're using a different port to start the mongod that'll accept the test results. Lines `538` to `573` in `master.cfg` cover the sections that deal with setting up and running mongo-perf. Once the build is complete:

- Navigate to `~/slave/Linux_64bit/mongo-perf`
- Start the mongo-perf web server: `python server.py`
- Navigate to `AWS_INSTANCE_HOST:8080` to view the results of the completed tests <br>

In production, the web interface is listening on port 8080 but with iptables setup to forward to port 80 &ndash; `iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080`

Congratulations! You have now successfully setup a test/QA environment using buildbot for mongo-perf! We now give a description of how to do this on your local machine.

##### Mongo-perf Operations on Local Machine
=========================
You will need to run the following commands to install the required packages for mongo-perf (don't forget the `-y` flag if you want to script). Before you install the following packages, ensure that you have `python 2.7.X (X >= 2)` and `mongodb` installed.
<pre><code>sudo apt-get update # update sources
sudo apt-get install python-setuptools # install setup tools
sudo apt-get install gcc # install gcc
sudo apt-get install python-dev # install python dev packages
sudo apt-get install git-core # install git
sudo apt-get install scons # install scons
sudo apt-get install build-essential # install build-essentiail
sudo apt-get install libboost-all-dev # install boost libraries
sudo easy_install pymongo # install pymongo
</code></pre>

- Clone the mongo-perf repo: `git clone https://github.com/mongodb/mongo-perf`
- Start mongod: `mongod --fork --syslog` (note we use port 27017)
- Start the web server: `python server.py`
- Navigate to `http://localhost:8080`
You should see the web server running there.

##### <a name="generating"></a>Generating Data
Now, you are ready to push some test data into mongod. In the mongo-perf repo, there is a file called `loader.py` which can be used to generate simulated data (by default, it produces 30 days worth of data &ndash; current day inclusive).

The tests take a bit of time to run so you can just shorten the period of data generated (see line `113` of `loader.py`) to just a couple of days (use `for time in xrange(-3, 2)`) and run the script to generate test data.

Once this has completed, navigate to `http://localhost:8080` to see the generated data.

### Mongo-perf Analysis/Reporting
=========================
Two scripts are responsible for managing the analysis/reporting part of mongo-perf &ndash; `analysismgr.py` and `jobsmgr.py`. `analysismgr.py` calls `jobsmgr.py` which in turn calls `mongo-perf.R`. Finally, `mongo-perf.R` calls `washer.R` to do the actual analysis.

A brief overview of what each script is responsible for:

- `analysismgr.py` &ndash; main analysis driver; ensures that indexes are in place and creates processing queues (producer)
- `jobsmgr.py` &ndash; analysis workhorse; pulls jobs from the queue for processing, calling `mongo-perf.R` in the process (consumer)
- `mongo-perf.R` &ndash; ensures that indexes are in place, prepares data for processing
- `washer.R` &ndash; does the data analysis/anomaly detection

See the source files for more documentation.

To get started on analysis/reporting, install the following:
<pre><code>sudo apt-get install r-base # install R 
git clone https://github.com/gerald-lindsly/rmongodb # clone the repo
cd rmongodb
unzip mongo-c-driver-src.zip -d  rmongodb/src/ # decompress archive
sudo R CMD INSTALL rmongodb # install the rmongodb driver
</code></pre>

*See [here](https://github.com/gerald-lindsly/rmongodb/) for the most up-to-date rmongodb installation instructions.*<br>

Once you have the packages installed, start mongod &ndash; `mongod --fork --syslog` (note we use port 27017).

Before you run analysis, you need data to analyze! For mongo-perf, we need at least three days' worth of data to run. If you took the buildbot route in setting up the operations side of mongo-perf, you will have to use `loader.py` to generate the historical data you require to run analysis. See [Generating Data](#generating) for more information.

With data, you are now ready to run some analysis: <pre><code>python analysismgr.py</code></pre>
This should begin the processing pipeline for both alerts and reports and open up web pages for any alerts and reports generated using the configuation in [alerts](/alert_definitions.ini) and [reports](/report_definitions.ini) configuration files respectively.

The default pipeline for both alerts and reports (as listed in ALERT_TASKS and REPORT_TASKS globals in `analysismgr.py`) show the result of the alerts/reports processing using your default web browser.

If you wish to receive email reports, change the last stage in pipeline in `analysismgr.py` to `send reports` for reports, and `send alerts` for alerts. Emails are sent using Amazon SES® so you will need an account on that to send reports (be sure to have your `aws_access_key_id` and `aws_secret_access_key` under `[Credentials]` in /etc/boto.cfg). See [here](https://code.google.com/p/boto/wiki/BotoConfig) for more information.

If you've gotten here, you're all set with mongo-perf &mdash; feel free to test and hack as you wish!

Please see the [README](/README.md) page for details.