#!/bin/bash
#Rewritten as of April 9th, 2014 by Dave Storch & Amalia Hawkins
#Find us if you have any questions, future user!
set -x
#Defaults
MPERFPATH=/home/mongo-perf/mongo-perf
BUILD_DIR=/home/mongo-perf/mongo
DBPATH=/home/mongo-perf/db
SHELLPATH=$BUILD_DIR/mongo
BRANCH=master
NUM_CPUS=$(grep ^processor /proc/cpuinfo | wc -l)
RHOST="mongo-perf-1.vpc1.build.10gen.cc"
RPORT=27017
BREAK_PATH=/home/mongo-perf/build-perf
TEST_DIR=$MPERFPATH/testcases
SLEEPTIME=60
THIS_PLATFORM=`uname -s || echo unknown`

function do_git_tasks() {
    cd $BUILD_DIR
    git checkout $BRANCH
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
    scons -j $NUM_CPUS --64 --release mongod mongo
}

function run_mongo-perf() {
    # Kick off a mongod process.
    cd $BUILD_DIR
    ./mongod --dbpath "${DBPATH}" --smallfiles --fork --logpath mongoperf.log
    # TODO: doesn't get set properly with --fork ?
    MONGOD_PID=$!

    sleep 30

    cd $MPERFPATH
    TIME="$(date "+%m%d%Y_%H:%M")"

    # list of testcase definitions
    TESTCASES=$(find testcases/ -name *.js)


    # list of thread counts to run (high counts first to minimize impact of first trial)
    THREAD_COUNTS="16 8 4 2 1"

    # drop linux caches
    sudo bash -c "echo 3 > /proc/sys/vm/drop_caches"

    # Run with single DB.
    python benchrun.py -l "${TIME}_${THIS_PLATFORM}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -f $TESTCASES --trialTime 5 --trialCount 8 --mongo-repo-path ${BUILD_DIR} --safe false -w 0 -j false --writeCmd false

    # drop linux caches
    sudo bash -c "echo 3 > /proc/sys/vm/drop_caches"

    # Run with multi-DB (4 DBs.)
    python benchrun.py -l "${TIME}_${THIS_PLATFORM}-multi" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -m 4 -f $TESTCASES --trialTime 5 --trialCount 8 --mongo-repo-path ${BUILD_DIR} --safe false -w 0 -j false --writeCmd false

    # Kill the mongod process and perform cleanup.
    kill -n 9 ${MONGOD_PID}
    pkill -9 mongod         # kills all mongod processes -- assumes no other use for host
    rm -rf $DBPATH/*

}


# housekeeping

# ensure numa zone reclaims are off
numapath=$(which numactl)
if [[ -x "$numapath" ]]
then
    echo "turning off numa zone reclaims"
    sudo numactl --interleave=all
else
    echo "numactl not found on this machine"
fi

# disable transparent huge pages
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled /sys/kernel/mm/transparent_hugepage/defrag

# if cpufreq scaling governor is present, ensure we aren't in power save (speed step) mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor


# main loop
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
        if [ $? == 0 ]
        then
            run_mongo-perf
        fi
    fi
done
