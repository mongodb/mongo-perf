#!/bin/bash
#Rewritten as of April 9th, 2014 by Dave Storch & Amalia Hawkins
#Find us if you have any questions, future user!

# script should work on Linux, Solaris, MacOSX
# for Windows, run under cygwin
THIS_PLATFORM=`uname -s || echo unknown`
THIS_HOST=$HOSTNAME
# environment details, within Windows or Linux
PLATFORM_SUFFIX=""
if [ $THIS_PLATFORM == 'CYGWIN_NT-6.1' ]
then
    THIS_PLATFORM='Windows'
    PLATFORM_SUFFIX="2K8"
elif [ $THIS_PLATFORM == 'CYGWIN_NT-6.2' ]
then
    THIS_PLATFORM='Windows'
    PLATFORM_SUFFIX="2K12"
elif [ $THIS_PLATFORM == 'CYGWIN_NT-6.3' ]
then
    THIS_PLATFORM='Windows'
    PLATFORM_SUFFIX="2K12R2"
fi

# *nix user name
RUNUSER=$(whoami)
if [ $THIS_PLATFORM == 'Linux' ]
then
    NUM_CPUS=$(grep ^processor /proc/cpuinfo | wc -l)
    NUM_SOCKETS=$(grep ^physical\ id /proc/cpuinfo | sort | uniq | wc -l)
elif [ $THIS_PLATFORM == 'Windows' ]
then
    NUM_CPUS=$(wmic cpu get NumberOfCores|grep -v NumberOfCores|egrep -v '^$' | paste -sd+ - | bc)
    NUM_SOCKETS=$(wmic cpu get NumberOfCores | grep -v NumberOfCores | egrep -v '^$' | wc -l)
elif [ $THIS_PLATFORM == 'Darwin' ]
then
    #NUM_CPUS=$(/usr/sbin/system_profiler | grep Cores: | cut -f2 -d:)
    NUM_CPUS=4
    NUM_SOCKETS=1
fi

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
# remote database to store results
# this example assumes a two-member replica set
RHOST="mongo-perf/mongo-perf-db-1.vpc3.10gen.cc,mongo-perf-db-2.vpc3.10gen.cc"
RPORT=27017
# create this file to un-daemonize (exit the loop)
BREAK_PATH=${MPERFBASE}/build-perf
# trying to use sudo for cache flush, et al
SUDO=sudo
# seconds between polls
SLEEPTIME=60
# uncomment to fetch recently-built binaries from mongodb.org instead of compiling from source
#FETCHMCI='TRUE'
DLPATH="${MPERFPATH}/download"

if [ $THIS_PLATFORM == 'Windows' ]
then
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
    cd $BUILD_DIR || exit 1
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

        cd ${MPERFPATH} || exit 1
        echo "downloading binary artifacts from MCI"
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            if [ $BRANCH == 'master' ]
            then
                python `cygpath -w ${MPERFPATH}/util/get_binaries.py` --dir `cygpath -w "${DLPATH}"` --distribution 2008plus
            else
                python `cygpath -w ${MPERFPATH}/util/get_binaries.py` --revision ${BRANCH} --dir `cygpath -w "${DLPATH}"` --distribution 2008plus
            fi
        else
            if [ $BRANCH == 'master' ]
            then
                python ${MPERFPATH}/util/get_binaries.py --dir "${DLPATH}"
            else
                python ${MPERFPATH}/util/get_binaries.py --revision ${BRANCH} --dir "${DLPATH}"
            fi
        fi
        chmod +x ${DLPATH}/${MONGOD}
        cp -p ${DLPATH}/${MONGOD} ${BUILD_DIR}
        cp -p ${DLPATH}/${MONGO} ${BUILD_DIR}
        BINHASH=""
        BINHASH=$(${DLPATH}/${MONGOD} --version | egrep git.version|perl -pe '$_="$1" if m/git.version:\s(\w+)/')
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

function determine_build_args() {
    BUILD_ARGS="--64 --release"
    if [ ! -z "$WT_INSTALL" ]
    then
      BUILD_ARGS=$BUILD_ARGS" --wiredtiger --cpppath=$WT_INSTALL/include --libpath=$WT_INSTALL/lib"
    fi
}

function run_build() {
    cd $BUILD_DIR
    determine_build_args
    if [ -z $FETCHMCI ]
    then
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            ${SCONSPATH} -j ${NUM_CPUS} ${BUILD_ARGS} --win2008plus ${MONGOD} ${MONGO}
        else
            ${SCONSPATH} -j ${NUM_CPUS} ${BUILD_ARGS} ${MONGOD} ${MONGO}
        fi
    fi
}

function determine_cpu_masks() {
    BENCHRUN_MASK=""
    MONGOD_MASK=""

    if [ $THIS_PLATFORM == 'Linux' ]
    then
        # how many cores to use for benchrun (i.e. NUM_CPUS * (1 / FACTOR))
        FACTOR=4

        # If multi socket, then use the first socket for benchrun and the rest for mongod, otherwise take a percentage of cores
        # to run benchrun and mongod
        if [ "$NUM_SOCKETS" == 1 ]
            then
            BENCHRUN_MASK=0-$(bc <<< "($NUM_CPUS / $FACTOR ) -1")
            MONGOD_MASK=$(bc <<< "($NUM_CPUS / $FACTOR )")-$(bc <<< "($NUM_CPUS -1 )")
        else
            BENCHRUN_MASK=`numactl --hardware | grep ^node\ 0\ cpus: | sed -r 's/node 0 cpus: //' | sed -r 's/ /,/g'`
            for i in `seq 1 $NUM_SOCKETS`
            do
                MONGOD_MASK=$MONGOD_MASK","`numactl --hardware | grep ^node\ $i\ cpus: | sed -r 's/node '"$i"' cpus: //' | sed -r 's/ /,/g'`
            done
            MONGOD_MASK=`echo $MONGOD_MASK | sed -r 's/,//' | sed 's/,*$//'`
        fi
    fi
}

function determine_process_invocation() {
    MONGOD_START=""
    BR_START=""
    if [ $THIS_PLATFORM == 'Linux' ]
    then
        # ensure numa zone reclaims are off
        if [ -x `which numactl` ]
        then
            MONGOD_START="numactl --physcpubind="$MONGOD_MASK" --interleave=all "
            BR_START="taskset -c "$BENCHRUN_MASK" "
        elif [-x `which taskset` ]
        then
            MONGOD_START="taskset -c "$MONGOD_MASK" "
            BR_START="taskset -c "$BENCHRUN_MASK" "
        else
            MONDOD_START=""
            BR_START=""
        fi
    fi
}

function determine_bench_threads() {
    # want to measure more threads than cores
    THREAD_COUNTS="1 2 4 6"
    TOTAL_THREADS=$(bc <<< "($NUM_CPUS * 1.5 )")
    for i in `seq 8 4 $TOTAL_THREADS`
    do
        THREAD_COUNTS=$THREAD_COUNTS" "$i
    done
}

function determine_storage_engines() {
    SE_MMAP="mmapv1"
    if [ ! -z "$WT_INSTALL" ]
    then
        SE_WT="wiredtiger"
    fi
}

function run_mongo_perf() {
    # Setup
    determine_cpu_masks
    determine_storage_engines
    determine_process_invocation

    # Run for mulltiple storage engines
    for STORAGE_ENGINE in $SE_WT $SE_MMAP
    do

        # Kick off a mongod process.
        cd $BUILD_DIR

        if [ $STORAGE_ENGINE == "mmapv1" ]
        then
            EXTRA="--syncdelay 14400"
        elif [ $STORAGE_ENGINE == "wiredtiger" ]
        then
            EXTRA='--wiredTigerEngineConfig "checkpoint=(wait=14400)"'
        else
            EXTRA=""
        fi

        if [ $THIS_PLATFORM == 'Windows' ]
        then
            rm -rf `cygpath -u $DBPATH`/*
             (eval ./${MONGOD} --dbpath "${DBPATH}" $EXTRA --storageEngine=$STORAGE_ENGINE --logpath mongoperf.log &)
        else
            rm -rf $DBPATH/*
            (eval ${MONGOD_START} ./${MONGOD} --dbpath "${DBPATH}" "$EXTRA" --storageEngine=$STORAGE_ENGINE --fork --logpath mongoperf.log)
        fi
        # TODO: doesn't get set properly with --fork ?
        MONGOD_PID=$!

        sleep 30

        cd $MPERFPATH
        TIME="$(date "+%Y%m%d_%H:%M")"

        # list of testcase definitions
        TESTCASES=$(find testcases -name "*.js")

        # list of thread counts to run (high counts first to minimize impact of first trial)
        determine_bench_threads

        # drop linux caches
        if [ $THIS_PLATFORM == 'Linux' ]
        then
            ${SUDO} bash -c "echo 3 > /proc/sys/vm/drop_caches"
        fi

        # Run with single DB.
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            python benchrun.py -l "${THIS_PLATFORM}-${THIS_HOST}-${PLATFORM_SUFFIX}-${LAST_HASH}-${STORAGE_ENGINE}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -f $TESTCASES --trialTime 5 --trialCount 1 --mongo-repo-path `cygpath -w ${BUILD_DIR}` --writeCmd true
        else
            ${BR_START} python benchrun.py -l "${THIS_PLATFORM}-${THIS_HOST}-${PLATFORM_SUFFIX}-${LAST_HASH}-${STORAGE_ENGINE}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -f $TESTCASES --trialTime 5 --trialCount 1 --mongo-repo-path ${BUILD_DIR} --writeCmd true
        fi

        # drop linux caches
        ${SUDO} bash -c "echo 3 > /proc/sys/vm/drop_caches"

        # Run with multi-DB
        if [ ! -z "$MPERF_MULTI_DB" ]
        then
            if [ $THIS_PLATFORM == 'Windows' ]
            then
                python benchrun.py -l "${THIS_PLATFORM}-${THIS_HOST}-${PLATFORM_SUFFIX}-${LAST_HASH}-${STORAGE_ENGINE}-multidb${MPERF_MULTI_DB}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -m $MPERF_MULTI_DB -f $TESTCASES --trialTime 5 --trialCount 1 --mongo-repo-path `cygpath -w ${BUILD_DIR}` --writeCmd true
            else
                ${BR_START} python benchrun.py -l "${THIS_PLATFORM}-${THIS_HOST}-${PLATFORM_SUFFIX}-${LAST_HASH}-${STORAGE_ENGINE}-multidb${MPERF_MULTI_DB}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -m $MPERF_MULTI_DB -f $TESTCASES --trialTime 5 --trialCount 1 --mongo-repo-path ${BUILD_DIR} --writeCmd true
            fi
        fi

        ${SUDO} bash -c "echo 3 > /proc/sys/vm/drop_caches"

        # Run with multi-collection.
        if [ ! -z "$MPERF_MULTI_COLL" ]
        then
            if [ $THIS_PLATFORM == 'Windows' ]
            then
                python benchrun.py -l "${THIS_PLATFORM}-${THIS_HOST}-${PLATFORM_SUFFIX}-${LAST_HASH}-${STORAGE_ENGINE}-multicoll${$MPERF_MULTI_COLL}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -f $TESTCASES --trialTime 5 --trialCount 1 --mongo-repo-path `cygpath -w ${BUILD_DIR}` --writeCmd true --multicoll $MPERF_MULTI_COLL
            else
                ${BR_START} python benchrun.py -l "${THIS_PLATFORM}-${THIS_HOST}-${PLATFORM_SUFFIX}-${LAST_HASH}-${STORAGE_ENGINE}-multicolli${$MPERF_MULTI_COLL}" --rhost "$RHOST" --rport "$RPORT" -t ${THREAD_COUNTS} -s "$SHELLPATH" -f $TESTCASES --trialTime 5 --trialCount 1 --mongo-repo-path ${BUILD_DIR} --writeCmd true --multicoll $MPERF_MULTI_COLL
            fi
        fi


        # Kill the mongod process and perform cleanup.
        kill -n 9 ${MONGOD_PID}
        pkill -9 ${MONGOD}         # kills all mongod processes -- assumes no other use for host
        pkill -9 mongod            # needed this for loitering mongod executable w/o .exe extension?
        sleep 5
        rm -rf ${DBPATH}/*
    done
}


# housekeeping

if [ $THIS_PLATFORM == 'Linux' ]
then
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
            run_mongo_perf
        fi
    fi
    if [ -e $BREAK_PATH ]
    then
        break
    fi
done
