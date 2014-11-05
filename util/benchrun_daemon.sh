#!/bin/bash
#Rewritten as of April 9th, 2014 by Dave Storch & Amalia Hawkins
#Find us if you have any questions, future user!

# script should work on Linux, Solaris, MacOSX
# for Windows, run under cygwin

function get_script_path()
{
    SOURCE="${BASH_SOURCE[0]}"
    while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
      DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
      SOURCE="$(readlink "$SOURCE")"
      [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
    done
    DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
    echo "${DIR}"
}

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
FETCHMCI='TRUE'
DLPATH="${MPERFPATH}/download"
LOG_DIRECTORY=


#### Binaries Options
# for MCI pulls
BINARIES_MCI_PROJECT="mongodb-mongo-master"
#BINARIES_MCI_VARIANT="linux-64"
# for .org site pulls
#BINARIES_BRANCH="v2.6"
#BINARIES_VERSION="2.6.5"
#BINARIES_DISTRIBUTION="ubuntu1404"
#BINARIES_CPU_ARCH="x86_64"


if [ $THIS_PLATFORM == 'Windows' ]
then
    SCONSPATH=scons.bat
    SHELLPATH=`cygpath -w ${SHELLPATH}.exe`
    MONGOD=mongod.exe
    MONGO=mongo.exe
    DBPATH=`cygpath -w ${DBPATH}`
    SUDO=''
    BINARIES_DISTRIBUTION='2008plus'
fi



# allow a branch or tag to be passed as the first argument
if [ $# == 1 ]
then
    BRANCH=$1
fi



CONFIG_FILE_PATH=$(get_script_path)
if [ -f "${CONFIG_FILE_PATH}/benchrun_daemon.conf" ]
then
    source "${CONFIG_FILE_PATH}/benchrun_daemon.conf"
fi

function get_binaries_options()
{
    BINARIES_OPTIONS=""
    if [[ -n "$BINARIES_MCI_PROJECT" ]]
    then
       BINARIES_OPTIONS+=" --project=${BINARIES_MCI_PROJECT}"
    fi
    if [[ -n "$BINARIES_MCI_VARIANT" ]]
    then
       BINARIES_OPTIONS+=" --variant=${BINARIES_MCI_VARIANT}"
    fi
    if [[ "$BRANCH" == "master"  ]]
    then
        if [[ -n "$BINARIES_BRANCH" ]]
        then
           BINARIES_OPTIONS+=" --branch=${BINARIES_BRANCH}"
        fi
        if [[ -z "$BINARIES_BRANCH" && -n "$BINARIES_VERSION" ]]
        then
           BINARIES_OPTIONS+=" --revision=${BINARIES_VERSION}"
        fi
    else
        BINARIES_OPTIONS+=' --revision=${BINARIES_VERSION:$BRANCH}'
    fi
    if [[ -n "$BINARIES_DISTRIBUTION" ]]
    then
       BINARIES_OPTIONS+=" --distribution=${BINARIES_DISTRIBUTION}"
    fi
    if [[ -n "$BINARIES_CPU_ARCH" ]]
    then
       BINARIES_OPTIONS+=" --cpu=${BINARIES_CPU_ARCH}"
    fi
    echo ${BINARIES_OPTIONS}
}

function do_git_tasks() {
    if [ -z $FETCHMCI ]
    then
        cd "$BUILD_DIR" || exit 1
        rm -rf build
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
        if [[ ! -d "$BUILD_DIR" ]]
        then
            mkdir -p "$BUILD_DIR"
        fi
        cd ${MPERFPATH} || exit 1
        echo "downloading binary artifacts from MCI"
        BINARIES_OPTIONS=$(get_binaries_options)
        echo "Getting Binaries with options: ${BINARIES_OPTIONS}"
        if [ $THIS_PLATFORM == 'Windows' ]
        then
                python `cygpath -w ${MPERFPATH}/util/get-mongodb-binaries` --dir `cygpath -w "${DLPATH}"` ${BINARIES_OPTIONS}
        else
                python ${MPERFPATH}/util/get-mongodb-binaries --dir "${DLPATH}" ${BINARIES_OPTIONS}
        fi
        chmod +x ${DLPATH}/${MONGOD}
        cp -p ${DLPATH}/${MONGOD} ${BUILD_DIR}
        cp -p ${DLPATH}/${MONGO} ${BUILD_DIR}

    fi

    BINHASH=""
    BINHASH=$(${DLPATH}/${MONGOD} --version | egrep git.version|perl -pe '$_="$1" if m/git.version:\s(\w+)/')

    if [ -z "$LAST_HASH" ]
    then
        LAST_HASH=${BINHASH}
        return 1
    else
        NEW_HASH=${BINHASH}
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
    if [ -z $FETCHMCI ]
    then
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
    if [[ "${TOTAL_THREADS%.*}" -ge 8 ]]
    then
        for i in `seq 8 4 $TOTAL_THREADS`
        do
            THREAD_COUNTS+=" ${i}"
        done
    else
        THREAD_COUNTS+=" 8"
    fi

}

function determine_storage_engines() {
    SE_MMAP="mmapv1"
    if [ ! -z "$WT_INSTALL" ]
    then
        SE_WT="wiredtiger"
    fi
}

function clear_caches() {
    if [ $THIS_PLATFORM == 'Linux' ]
    then
        ${SUDO} bash -c "echo 3 > /proc/sys/vm/drop_caches"
    fi
}

function get_benchrun_options() {
    BENCHRUN_OPTIONS=-"-l ${THIS_PLATFORM}-${THIS_HOST}-${PLATFORM_SUFFIX}-${LAST_HASH}-${STORAGE_ENGINE}"
    BENCHRUN_OPTIONS+=" --rhost ${RHOST} --rport ${RPORT} -t ${THREAD_COUNTS} -s ${SHELLPATH} -f ${TESTCASES} --trialTime 5 --trialCount 1 --writeCmd true"

    if [ -z $FETCHMCI ]
    then
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            BENCHRUN_OPTIONS+=" --mongo-repo-path \"`cygpath -w ${BUILD_DIR}`\""
        else
            BENCHRUN_OPTIONS+=" --mongo-repo-path \"${BUILD_DIR}\""
        fi
    fi
    echo ${BENCHRUN_OPTIONS}
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
        cd $BUILD_DIR || exit 1
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            rm -rf `cygpath -u $DBPATH`/*
            (./${MONGOD} --dbpath "${DBPATH}" --smallfiles --nojournal --syncdelay 43200 --storageEngine=$STORAGE_ENGINE --logpath mongoperf.log &)
        else
            rm -rf $DBPATH/*
            ${MONGOD_START} ./${MONGOD} --dbpath "${DBPATH}" --smallfiles --nojournal --syncdelay 43200 --storageEngine=$STORAGE_ENGINE --fork --logpath mongoperf.log
        fi
        # TODO: doesn't get set properly with --fork ?
        MONGOD_PID=$!


        cd $MPERFPATH
        TIME="$(date "+%Y%m%d_%H:%M")"

        # list of testcase definitions
        TESTCASES=$(find testcases -name "*.js")

        # list of thread counts to run (high counts first to minimize impact of first trial)
        determine_bench_threads

        BR_OPTIONS=$(get_benchrun_options)

        clear_caches

        ${BR_START} python benchrun.py ${BR_OPTIONS}

        clear_caches

        # Run with multi-DB (4 DBs.)
        if [ ! -z "$MPERF_MULTI_DB" ]
        then
            ${BR_START} python benchrun.py ${BR_OPTIONS} -m 4
        fi

        clear_caches

        # Run with multi-collection.
        if [ ! -z "$MPERF_MULTI_COLL" ]
        then
            ${BR_START} python benchrun.py ${BR_OPTIONS} -m 4 $MPERF_MULTI_COLL
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
