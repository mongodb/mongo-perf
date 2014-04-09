#!/bin/bash
#Rewritten as of April 9th, 2014 by Dave Storch & Amalia Hawkins
#Find us if you have any questions, future user!
set -x
#Defaults
MPERFPATH=/home/mongo-perf/mongo-perf
BUILD_DIR=/home/mongo-perf/mongo
SHELLPATH=$BUILD_DIR/mongo
DBPATH=$BUILD_DIR/db
BRANCH=master
NUM_CPUS=$(grep ^processor /proc/cpuinfo | wc -l)
RHOST="mongo-perf-1.vpc1.build.10gen.cc"
RPORT=27017
BREAK_PATH=/home/mongo-perf/build-perf
TEST_DIR=$MPERFPATH/testcases
SLEEPTIME=60

function do_git_tasks() {
    cd $BUILD_DIR
    git checkout $BRANCHG
    git clean -fqdx
    git pull

    if [ -z "$LAST_HASH" ]
    then
        LAST_HASH=$(git rev-parse HEAD)
        return 1
    else
        NEW_HASH=$(git rev-parse HEAD)
        if [ "$LAST_HASH" == "$NEW_HASH" ]
        then
            return 0
        else
            LAST_HASH=$NEW_HASH
            return 1
        fi
    fi
}

function run_build() {
    cd $BUILD_DIR
    scons -j $NUM_CPUS mongod mongo
}

function run_mongo-perf() {
    # Kick off a mongod process.
    cd $BUILD_DIR
    ./mongod --dbpath "$(DBPATH)" &
    MONGOD_PID=$!

    cd $MPERFPATH
    TIME="$(date "+%m%d%Y|%H:%M")"
    echo $TIME

    TESTCASES=$(ls $TESTDIR)
    # Run with one DB.
    python benchrun.py -l "$TIME-linux" --rhost "$RHOST" --rport "$RPORT" -t 1 2 4 8 16 -s "$SHELLPATH" -f $TESTCASES
    # Run with multi-DB (4 DBs.)
    python benchrun.py -l "$TIME-linux" --rhost "$RHOST" --rport "$RPORT" -t 1 2 4 8 16 -s "$SHELLPATH" -m 4 -f $TESTCASES

    # Kill the mongod process.
    kill -9 $MONGOD_PID
}


while [ true ]
do
    if [ -e $BREAK_PATH ]
    then
        break
    fi
    do_git_tasks
    if [ $? == 0 ]
    then
        sleep $SLEEPTIME
        continue
    else
        run_build
        run_mongo-perf
    fi
done
