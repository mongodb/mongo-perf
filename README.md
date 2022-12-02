# MONGO-PERF:

Mongo-perf (not to be confused with mongoperf) is a micro benchmarking tool for the MongoDB server. It measures throughput of commands with regards to the number of threads.

**NOTE: this tool is primarily for internal use by MongoDB's performance testing ecosystem. It is not supported for users outside MongoDB. Use at your own risk.**

### OVERVIEW:
This repo contains scripts to run benchmark tests for MongoDB.

### DEPENDENCIES:
Since 6.0, the legacy "mongo" shell has been replaced with "mongosh" which does not support benchRun(). To run this micro benchmark with MongoDB 6.0 you'll also need to download the 5.0 legacy "mongo" shell and ensure it's in your path. The legacy mongo shell is no longer officially supported for use with the MongoDB server, so there is no guarantee of forwards compatibility between the 5.0 legacy shell and more recent versions of the MongoDB server.

*General Benchmarking Dependencies*  
* Python >= 3.0  
* mongo shell >= 2.7.7-pre- (at revision 881b3a97fb5080b4e5d5ce11ad016da73ea23931 or newer)  

*Installing Python Dependencies*
`pip install -r requirements.txt`

*Python Benchmarking Dependencies*  
* argparse  

*Python Reporting Dependencies*  
* bottle  
* pymongo  

### HOW TO RUN:
*To run a micro benchmarking test or tests:*  
`python benchrun.py -f <list of testfiles> -t <list of thread configs> [-m <number of dbs>] [-s <shell path>]`  

For example, to run the `simple_insert.js` test case on 1, 2, and 4 threads, no multi-db and using the basic mongo shell:  
`python benchrun.py -f testcases/simple_insert.js  -t 1 2 4`

To run the single test case 'Queries.Empty` on 1, 2, and 4 thread:
`python benchrun.py -f testcases/* --includeFilter Queries.Empty -t 1 2 4`


To run all insert and update test cases on 1, 2, and 4 threads, for 10
seconds each using the basic mongo shell:  
`python benchrun.py -f testcases/* -t 1 2 4 --includeFilter insert update --trialTime 10`

To run all insert and update test cases that are also have the tag
core on 1, 2, and 4 threads, for 10
seconds each using the basic mongo shell:  
`python benchrun.py -f testcases/* -t 1 2 4 --includeFilter insert update --includeFilter core --trialTime 10`

For a complete list of options :  
`python benchrun.py --help`

### RESULT CHANGES

Mongo-perf is built upon the Mongo shell benchrun command. The results
format of benchrun changed in Mongo 3.1.5 and 3.0.5. Because of the
result changes, mongo-perf results from before 3.1.5 or 3.0.5 may not
be directly comparable to results after 3.1.5 or 3.0.5.

As of Mongo 3.1.5 and 3.0.5 the benchrun command measures op performance on the client side,
instead of on the server side. Any and only those ops passed into the op array of the benchrun
command are counted as ops for the purpose of reporting throughput. In some cases this may cause
the reported throughput to be higher than previous version of mongo-perf (for instance, if the
"let" operation is used), or lower than before (for instance, if the shell issues getMore commands
in addition to a query in order to complete an op).

