#!/bin/bash
#Rewritten as of April 9th, 2014 by Dave Storch & Amalia Hawkins
#Find us if you have any questions, future user!

# script should work on Linux, Solaris, MacOSX
# for Windows, run under cygwin
THIS_PLATFORM=`uname -s || echo unknown`
if [ $THIS_PLATFORM == 'CYGWIN_NT-6.1' ]
then
    THIS_PLATFORM='Windows'
fi
if [ $THIS_PLATFORM == 'CYGWIN_NT-6.3' ]
then
    THIS_PLATFORM='Windows'
fi

# *nix user name
RUNUSER=mongo-perf
# mongo-perf base directory
if [ $THIS_PLATFORM == 'Darwin' ]
then
    MPERFBASE=/Users/${RUNUSER}
else
    MPERFBASE=/home/${RUNUSER}
fi
# mongo-perf working directory
MPERFPATH=${MPERFBASE}/mongo-perf
# build directory
BUILD_DIR=${MPERFBASE}/mongo
export BUILD_DIR
# test database
DBPATH=${MPERFBASE}/db
# executables
SCONSPATH=scons
MONGOD=mongod
MONGO=mongo
# path mongo shell
SHELLPATH=${BUILD_DIR}/${MONGO}
# branch to monitor for checkins
BRANCH=master
NUM_CPUS=$(grep ^processor /proc/cpuinfo | wc -l)
# remote database to store results
# in C++ driver ConnectionString / DBClientConnection format
# this example assumes a two-member replica set
RHOST="mongo-perf/mongo-perf-db-1.vpc3.10gen.cc,mongo-perf-db-2.vpc3.10gen.cc"
RPORT=27017
# create this file to un-daemonize (exit the loop)
BREAK_PATH=${MPERFBASE}/build-perf
# trying to use sudo for cache flush, et al
SUDO=sudo
# test agenda from all .js files found here
TEST_DIR=${MPERFPATH}/testcases
# seconds between polls
SLEEPTIME=60
# uncomment to fetch recently-built binaries from mongodb.org instead of compiling from source
#FETCHMCI='TRUE'

if [ $THIS_PLATFORM == 'Windows' ]
then
    THIS_PLATFORM='Windows'
    SCONSPATH=scons.bat
    SHELLPATH=`cygpath -w ${SHELLPATH}.exe`
    MONGOD=mongod.exe
    MONGO=mongo.exe
    DBPATH=`cygpath -w ${DBPATH}`
    SUDO=''
fi

# allow a branch or tag to be passed as the first argument
if [ $# == 1 ]
then
    BRANCH=$1
fi

function do_git_tasks() {
    cd $BUILD_DIR
    rm -rf build

    if [ -z $FETCHMCI ]
    then
        # local compile
        # some extra gyration here to allow/automate a local patch
        git checkout -- .
        git checkout master
        git pull
        git checkout $BRANCH
        git pull
        git clean -fqdx
        # apply local patch here, if any
        #patch -p 1 -F 3 < ${HOME}/pinValue.patch
    else
        # fetch latest binaries from MCI
        git checkout -- .
        git checkout master
        git pull
        git clean -fqdx

        mkdir ${BUILD_DIR}/build
        cd ${BUILD_DIR}/build
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            python `cygpath -w ${MPERFPATH}/util/get_binaries.py` --dir `cygpath -w "${BUILD_DIR}"` --platform 2008plus
            unzip ${BUILD_DIR}/mongodb-*-latest.zip
            chmod +x */bin/*.exe
        else
            python ${MPERFPATH}/util/get_binaries.py --dir "${BUILD_DIR}"
            tar xzpf ${BUILD_DIR}/mongodb-*-latest.tgz 
        fi
        mv */bin/* ${BUILD_DIR}
        BINHASH=$(${BUILD_DIR}/${MONGOD} --version | egrep git.version|perl -pe '$_="$1" if m/git.version:\s(\w+)/')
        if [ -z $BINHASH ]
        then
            echo "ERROR: could not determine git commit hash from downloaded binaries"
        else
            cd $BUILD_DIR
            git checkout $BINHASH
            git pull
        fi
    fi

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
    if [ -z $FETCHMCI ]
    then
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            ${SCONSPATH} -j $NUM_CPUS --64 --release --win2008plus ${MONGOD} ${MONGO}
        else
            ${SCONSPATH} -j $NUM_CPUS --64 --release ${MONGOD} ${MONGO}
        fi
    fi
}

function run_mongo-perf() {
    # Kick off a mongod process.
    cd $BUILD_DIR
    if [ $THIS_PLATFORM == 'Windows' ]
    then
        rm -rf `cygpath -u $DBPATH`/*
        (./${MONGOD} --dbpath "${DBPATH}" --smallfiles --logpath mongoperf.log &)
    else
        rm -rf $DBPATH/*
        ./${MONGOD} --dbpath "${DBPATH}" --smallfiles --fork --logpath mongoperf.log
    fi
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
    ${SUDO} bash -c "echo 3 > /proc/sys/vm/drop_caches"

    # Run with single DB.
    if [ $THIS_PLATFORM == 'Windows' ]
    then
        python benchrun.py -l "${TIME}_${THIS_PLATFORM}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -f $TESTCASES --trialTime 5 --trialCount 7 --mongo-repo-path `cygpath -w ${BUILD_DIR}` --safe false -w 0 -j false --writeCmd false
    else
        python benchrun.py -l "${TIME}_${THIS_PLATFORM}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -f $TESTCASES --trialTime 5 --trialCount 7 --mongo-repo-path ${BUILD_DIR} --safe false -w 0 -j false --writeCmd false
    fi

    # drop linux caches
    ${SUDO} bash -c "echo 3 > /proc/sys/vm/drop_caches"

    # Run with multi-DB (4 DBs.)
    if [ $THIS_PLATFORM == 'Windows' ]
    then
        python benchrun.py -l "${TIME}_${THIS_PLATFORM}-multi" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -m 4 -f $TESTCASES --trialTime 5 --trialCount 7 --mongo-repo-path `cygpath -w ${BUILD_DIR}` --safe false -w 0 -j false --writeCmd false
    else
        python benchrun.py -l "${TIME}_${THIS_PLATFORM}-multi" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -m 4 -f $TESTCASES --trialTime 5 --trialCount 7 --mongo-repo-path ${BUILD_DIR} --safe false -w 0 -j false --writeCmd false
    fi

    # Kill the mongod process and perform cleanup.
    kill -n 9 ${MONGOD_PID}
    pkill -9 ${MONGOD}         # kills all mongod processes -- assumes no other use for host
    pkill -9 mongod            # needed this for loitering mongod executable w/o .exe extension?
    sleep 5
    rm -rf ${DBPATH}/*

}


# housekeeping

# ensure numa zone reclaims are off
numapath=$(which numactl)
if [[ -x "$numapath" ]]
then
    echo "turning off numa zone reclaims"
    ${SUDO} numactl --interleave=all
else
    echo "numactl not found on this machine"
fi

# disable transparent huge pages
if [ -e /sys/kernel/mm/transparent_hugepage/enabled ]
then
    echo never | ${SUDO} tee /sys/kernel/mm/transparent_hugepage/enabled /sys/kernel/mm/transparent_hugepage/defrag
fi

# if cpufreq scaling governor is present, ensure we aren't in power save (speed step) mode
if [ -e /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]
then
    echo performance | ${SUDO} tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
fi


# main loop
while [ true ]
do
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
    if [ -e $BREAK_PATH ]
    then
        break
    fi
done
