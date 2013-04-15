# Mongo-perf Test/QA

Mongo-perf is comprised of two broad and complementary parts:

- Operations - this can be integrated (optionally) as part of buildbot and is responsible for running benchmark tests

- Analysis/Reporting - this runs analysis on benchmarked data and reports on any anomalies detected in the most recent benchmark tests.

This documentation will cover how to setup and test both parts of the system.

##Setup

### Mongo-perf Operations
=========================

The operational side of mongo-perf could either be setup as part of buildbot or could be run on a local machine (this is much easier). I will cover how to setup the operation side using either of these.

These are all the packages you need installed. You can install these as required - as done in the steps provided below, or just run it all at once in a script (don't forget the -y flag). We recommend going step by step though; in case you run into some issues.
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
	- 27017 (mongodb)<br/>
	(or you can just use the "benchmarking" security group in `AWS_TEST` if it still exists)
- Ensure you have python 2.7.X (X >= 2) installed
- Download package lists from the repositories: sudo apt-get update
- Install easy_install: `sudo apt-get install python-setuptools`
- Install gcc: `sudo apt-get install gcc`
- Install pytho-dev: `sudo apt-get install python-dev`
- Install buildbot: `sudo easy_install buildbot`
- Create a buildbot master: `buildbot create-master master`
(if you get an error like: `from sqlalchemy import exceptions as sa_exceptions ImportError: cannot import name exceptions` you need to change the import statement in the referenced file to `from sqlalchemy import exc as sa_exceptions` - sqlalchemy has some issues)
- Change line `754` in the supplied `master.cfg` to your email address so you can receive notifications on how the build process is performing
- Change line `561` to point to the `AWS_INSTANCE_HOST` you have set up
- Use the sample config: put `master.cfg` under the master directory
- Start the buildbot master: buildbot start master
- Navigate to `AMI_INSTANCE_HOST:8010` to view your new buildbot

-The supplied buildbot config contains a triggered scheduler which allows you to run mongo-perf anytime you want. It also contains a nightly scheduler that pulls and runs mongo-perf every night. 

If you navigate to Builders >> Linux 64-bit, you'll notice that our buildslave `mongoperf` is shown to be offline. We need to get our slaves working!

So let's start up our slave. To do this, run the following:
- Install the buildbot-slave: `sudo easy_install buildbot-slave`
- Create the buildbot slave: `buildslave create-slave slave localhost:9989 mongoperf zxcasd` (this username/password combination is the same as that used in the supplied `master.cfg` file).
- Start the buildslave: `buildslave start slave`

-If you navigate back to Builders >> Linux 64-bit, you should see that the slave is now listed as "connected".


Now you've set up both a buildbot master alongside an accompanying slave. You'll notice in the buildbot master configuration that code to pull in mongo (from lines `160` onwards) have been commented out. This takes quite a bit of time so to make this easier, you can just download the appropriate `mongod` executable from `http://www.mongodb.org/downloads` and put it in:
`~/slave/Linux_64bit/mongo/` (you have to create the mongo directory)

As at the time of this writing, the most recent version is 2.4.1.
<pre><code>wget http://fastdl.mongodb.org/linux/mongodb-linux-x86_64-2.4.1.tgz
tar xvzf mongodb-linux-x86_64-2.4.1.tgz
mv mongodb-linux-x86_64-2.4.1/bin/- ~/slave/Linux_64bit/mongo/
</code></pre>

Note that in production, mongodb is pulled from github and compiled on the buildslave into this directory. We only pull it here for expediency - the effects are the same. Now that we have mongodb where we want it, we have to go ahead and install other applications that we need to run a successful build of mongo-perf:

- Install git: `sudo apt-get install git-core`
- Install scons: `sudo apt-get install scons`
- Install build-essential: `sudo apt-get install build-essential`
- Install boost libraries: `sudo apt-get install libboost-all-dev`
- Install pymongo: `sudo easy_install pymongo`

Now you're all set to run your first triggered build! Navigate to `AMI_INSTANCE_HOST:8010`, Builders >> Linux 64-bit, and click the `Force Build` button. This will start a new build for mongo-perf. Click on its Build # under "Current Builds" to follow its progress. The build does a number of things:
- It clones the mongo-perf repo
- It compiles the mongo-cxx-driver
- It compiles mongo-perf 
- It runs the benchmark tests
- It writes the results to a database
(-Note that this might take over an hour for this to complete - depending on your hardware).<br>
-By default, mongo-perf on this buildbot will write its benchmark test results to the host pointed to at line `561` in `master.cfg` (which should now be your `AWS_INSTANCE_HOST`). Once the build is complete:

- Start mongod: `mongod --fork --syslog` (note we use port 27017)
- Navigate to `~/slave/Linux_64bit/mongo-perf`
- Start the mongo-perf web server: `python server.py`
- Navigate to `AWS_INSTANCE_HOST:8080` to view the results of the completed tests

Congratulations! You have now successfully setup a test/QA environment using buildbot for mongo-perf! We now give a description of how to do this on your local machine.

##### Mongo-perf Operations on Local Machine
=========================
You will need to run the following commands to install the required packages for mongo-perf (don't forget the -y flag if you want to script). Before you install the following packages, ensure that you have python 2.7.X (X >= 2) installed.
<pre><code>sudo apt-get update # update sources
sudo apt-get install python-setuptools # install setup tools
sudo apt-get install gcc # install gcc
sudo apt-get install python-dev # install python dev packages
sudo apt-get install git-core # install git
scons: sudo apt-get install scons # install scons
sudo apt-get install build-essential # install build-essentiail
sudo apt-get install libboost-all-dev # install boost libraries
sudo easy_install pymongo # install pymongo
</code></pre>

- Clone the mongo-perf repo: `git clone https://github.com/mongodb/mongo-perf`
- Start mongod: `mongod --fork --syslog` (note we use port 27017)
- Start the web server: `python server.py`
- Navigate to `http://localhost:8080`
You should see the web server running here:

Now, you are ready to push some test data into mongod. Since we  In the mongo-perf repo, there is a file called `loader.py`. This script generates simulated data (by default, it produces 30 days worth of data - current day inclusive).

The tests take a bit of time to run so you can just shorten the period of data generated (see line `113` of `loader.py`) to just a couple of days (use `for time in xrange(-2, 2)`) and run the script - `python loader.py`.

Once this has completed, navigate to `http://localhost:8080` to see a sample of the data it has generated.

### Mongo-perf Analysis/Reporting
=========================
Two scripts are responsible for the analysis/reporting part of mongo-perf - `analysismgr.py` and `jobsmgr.py`. 

To get started on this, install the following:
<pre><code>sudo apt-get install r-base # installs R
*Install rmongodb - see [here](https://github.com/gerald-lindsly/rmongodb) for details.
- Start mongod: `mongod --fork --syslog` (note we use port 27017)
</code></pre>

The default pipeline for both alerts and reports (as listed in ALERT_TASKS and REPORT_TASKS in `analysismgr.py`) show the result of the alerts/reports processing using your default web browser.

If you wish to receive email reports, change the last stage in pipeline in `analysismgr.py` to 'show report' for reports, and 'send alerts' for alerts. Emails are sent using Amazon SES® so you will need an account on that to send reports (be sure to have your `aws_access_key_id` and `aws_secret_access_key` under `[Credentials]` in /etc/boto.cfg).

*Note that you need at least three days' worth of data to run* `analysismgr.py`.

Please see the [README](/README.md/) page for details.