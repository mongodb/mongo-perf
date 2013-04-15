Test/QA Setup
=========================

Mongo-perf is comprised of two broad and complementary parts:

- The operational part - which can be integrated (optionally) as part of buildbot and is responsible for running benchmark tests

- The analysis part - which runs analysis on benchmarked data and reports on any anomalies detected in the most recent benchmark tests.

This documentation will cover how to setup and test both parts of the system.

Operational Mongo-perf

The operational side of mongo-perf could either be setup as part of buildbot or could be run on a local machine (this is much easier). I will cover how to setup the operation side using either of these.

These are all the packages you need installed. You can install these as required - as done in the steps provided below, or just run it all at once in a script (don't forget the -y flag). We recommend going step by step though; in case you run into some issues.

sudo apt-get update
sudo apt-get install python-setuptools
sudo apt-get install gcc
sudo apt-get install python-dev
sudo easy_install buildbot
buildbot create-master master
buildbot start master
sudo easy_install buildbot-slave
buildslave create-slave slave localhost:9989 mongoperf zxcasd
sudo apt-get install git-core
scons: sudo apt-get install scons
sudo apt-get install build-essential
sudo apt-get install libboost-all-dev
sudo easy_install pymongo


Operational on Buildbot
=========================
- Launch a new AMI image (This was tested on a 64-bit Ubuntu 12.04 t1.micro instance)
	Add rules to allow for the following inbound ports
	22 (SSH)
	80 (HTTP)
	8010 (Buildbot)
	9989 (Buildbot)
	27017 (mongodb)
	(or you can just use the "benchmarking" security group in AWS_TEST if it still exists)
- Ensure you have python 2.X (X >= 6) installed
- Download package lists from the repositories: sudo apt-get update
- Install easy_install: sudo apt-get install python-setuptools
- Install gcc: sudo apt-get install gcc
- Install pytho-dev: sudo apt-get install python-dev
- Install buildbot: sudo easy_install buildbot
- Create a buildbot master: buildbot create-master master
(if you get an error like: "from sqlalchemy import exceptions as sa_exceptions
ImportError: cannot import name exceptions" you need to change the import statement in the referenced file to "from sqlalchemy import exc as sa_exceptions
ImportError: cannot import name exceptions" - sqlalchemy has some issues)
- Change line 754 in the supplied "master.cfg" to your email address so you can receive notifications on how the build process is performing
- Change line 561 to point to the AWS_INSTANCE_HOST you have set up
- Use the sample config: put "master.cfg" under the master directory
- Start the buildbot master: buildbot start master
- Navigate to AMI_INSTANCE_HOST:8010 to view your new buildbot

*The supplied buildbot config contains a triggered scheduler which allows you to run mongo-perf anytime you want. It also contains a nightly scheduler that pulls and runs mongo-perf every night. 

If you navigate to Builders >> Linux 64-bit, you'll notice that our buildslave "mongoperf" is shown to be offline. We need to get our slaves working!

So let's start up our slave. To do this, run the following:
- Install the buildbot-slave: sudo easy_install buildbot-slave
- Create the buildbot slave: buildslave create-slave slave localhost:9989 mongoperf zxcasd (this username/password combination is in the supplied "master.cfg" file).
- Start the buildslave: buildslave start slave

*If you navigate back to Builders >> Linux 64-bit, you should see that the slave is now listed as "connected".


Now you've set up both a buildbot master alongside an accompanying slave. You'll notice in the buildbot master configuration that code to pull in mongo (from lines 160 onwards) have been commented out. This takes quite a bit of time so to make this easier, you can just download the appropriate 'mongod' executable from http://www.mongodb.org/downloads and put it in:
"~/slave/Linux_64bit/mongo/" (you have to create the mongo directory)

As at the time of this writing, the most recent version is 2.4.1.
- wget http://fastdl.mongodb.org/linux/mongodb-linux-x86_64-2.4.1.tgz
- tar xvzf mongodb-linux-x86_64-2.4.1.tgz
- mv mongodb-linux-x86_64-2.4.1/bin/* ~/slave/Linux_64bit/mongo/

Note that in production, mongodb is pulled from github and compiled on the buildslave into this directory. We only pull it here for expediency - the effects are the same. Now that we have mongodb where we want it, we have to go ahead and install other applications that we need to run a successful build of mongo-perf:

- Install git: sudo apt-get install git-core
- Install scons: sudo apt-get install scons
- Install build-essential: sudo apt-get install build-essential
- Install boost libraries: sudo apt-get install libboost-all-dev
- Install pymongo: sudo easy_install pymongo

Now you're all set to run your first triggered build! Navigate to AMI_INSTANCE_HOST:8010, Builders >> Linux 64-bit, and click the "Force Build" button. This will start a new build for mongo-perf. Click on its Build # under "Current Builds" to follow its progress. The build does a number of things:
- It clones the mongo-perf repo
- It compiles the mongo-cxx-driver
- It compiles mongo-perf 
- It runs the benchmark tests
- It writes the results to a database*

*By default, it writes the results to the host pointed to at line 561 (which should now be your AWS_INSTANCE_HOST)

- Once the build is complete, navigate to "~/slave/Linux_64bit/mongo-perf"
- Start the mongo-perf webserver "python server.py"
- Navigate to "AWS_INSTANCE_HOST:8080" to view the results of the completed tests

Congratulations! You have now successfully setup a test/QA environment using buildbot for mongo-perf! We now give a description of how to do this on your local machine.

Operational on Local Machine
=========================
You will need to run the following commands to install the required packages for mongo-perf (don't forget the -y flag if you want to script). Before you install the following packages, ensure that you have python 2.X (X >= 6) installed.

sudo apt-get update
sudo apt-get install python-setuptools
sudo apt-get install gcc
sudo apt-get install python-dev
sudo apt-get install git-core
scons: sudo apt-get install scons
sudo apt-get install build-essential
sudo apt-get install libboost-all-dev
sudo easy_install pymongo

- Clone the mongo-perf repo: git clone https://github.com/mongodb/mongo-perf
- Start mongod: mongod --fork --syslog
- Start the web server: python server.py
- Navigate to http://localhost:8080
You should see the web server running here:

Now, you are ready to push some test data into mongod. Since we  In the mongo-perf repo, there is a file called "loader.py". This script generates simulated data (by default, it produces 30 days worth of data - current day inclusive).

i-de682ebd

