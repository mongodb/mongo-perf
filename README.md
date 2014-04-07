# MONGO-PERF:

Mongo-perf (not to be confused with mongoperf) is a micro benchmarking tool for the MongoDB server. It measures throughput of commands with regards to the number of threads.

## OVERVIEW:
----------
This repo contains scripts to run benchmark tests for MongoDB.

## DEPENDENCIES:
----------
*General Benchmarking Dependencies*
Python >= 2.7.X < 3.0
MongoDB >= 2.7.0-pre-

*Python Benchmarking Dependencies*
argparse
pymongo
subprocess

*Python Reporting Dependencies*
bottle
boto (optional)

## HOW TO RUN:
----------

*To run a micro benchmarking test or tests:*
`python benchrun.py -f <list of testfiles> -t <list of thread configs> [-m <number of dbs>] [-r <report label>] [-s <shell path>]`

*To run the GUI interface to view results in a graph:*
`cd gui`
`python server.py`

Go to http://localhost:8080 to see the results.
