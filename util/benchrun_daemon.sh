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
MONGOD_LOG_PATH=${BUILD_DIR}/mongoperf.log
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
FETCH_BINARIES=true
DLPATH="${MPERFPATH}/download"
# benchrun tag filter
TEST_TAGS_FILTER="'sanity'"
# benchrun trials count
TEST_TRIALS_COUNT=1
# benchrun trials time
TEST_TRIALS_TIME=5
# benchrun write command
TEST_WRITE_COMMAND=true
# compile aguments
BUILD_ARGS="--64 --release"
# amount of time between data sync to disk
DISK_SYNC_DELAY=14400
# mutlti db runs
# MPERF_MULTI_DB=8
# mutli collection runs
# MPERF_MULTI_COLL=8
# submit to dyno
SUBMIT_TO_DYNO=false


#### Default Binaries Options
# for MCI pulls
#BINARIES_MCI_PROJECT="mongodb-mongo-master"
#BINARIES_MCI_VARIANT="linux-64"
# for .org site pulls
#BINARIES_BRANCH="v2.6"
#BINARIES_VERSION="2.6.5"
#BINARIES_DISTRIBUTION="ubuntu1404"
#BINARIES_CPU_ARCH="x86_64"
#BINARIES_MCI_SUCCESSFUL_TASKS="compile"


MMS_AUTOMATION=false
MMSA_TEMPLATE_DIR=${MPERFPATH}/configs
MMSA_ROOT=/home/ec2-user/replset
MMSA_CONFIG_FILE=${MMSA_ROOT}/cluster.json
MMSA_DOWNLOAD_ROOT=${MMSA_ROOT}/downloads
MMSA_LOG_ROOT=${MMSA_ROOT}/logs
MMSA_PID_ROOT=${MMSA_ROOT}/pids
MMSA_DATA_ROOT=${MMSA_ROOT}/data


TEST_HOST=localhost
TEST_PORT=27017
# TEST_REPLSET=something
TEST_WRITE_CONCERN=1
TEST_JOURNAL_CONFIRM=false




MMS_AUTOMATION=false

# allow a branch or tag to be passed as the first argument
if [ $# == 1 ]
then
    BRANCH=$1
fi

# Source the config file if its there
CONFIG_FILE_PATH=$(get_script_path)
if [ -f "${CONFIG_FILE_PATH}/benchrun_daemon.conf" ]
then
    source "${CONFIG_FILE_PATH}/benchrun_daemon.conf"
fi

if [ $THIS_PLATFORM == 'Windows' ]
then
    SCONSPATH=scons.bat
    SHELLPATH=`cygpath -w ${SHELLPATH}.exe`
    MONGOD=mongod.exe
    MONGO=mongo.exe
    DBPATH=`cygpath -w ${DBPATH}`
    SUDO=''
    BINARIES_DISTRIBUTION='2008plus'
    MONGOD_LOG_PATH=`cygpath -w ${MONGOD_LOG_PATH}`
fi

# clean up booleans
FETCH_BINARIES=$(echo ${FETCH_BINARIES} | tr '[:upper:]' '[:lower:]')
TEST_WRITE_COMMAND=$(echo ${TEST_WRITE_COMMAND} | tr '[:upper:]' '[:lower:]')
TEST_JOURNAL_CONFIRM=$(echo ${TEST_JOURNAL_CONFIRM} | tr '[:upper:]' '[:lower:]')
MMS_AUTOMATION=$(echo ${MMS_AUTOMATION} | tr '[:upper:]' '[:lower:]')

function determine_get_binaries_options()
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
        BINARIES_OPTIONS+=" --revision=${BINARIES_VERSION:-$BRANCH}"
    fi
    if [[ -n "$BINARIES_DISTRIBUTION" ]]
    then
       BINARIES_OPTIONS+=" --distribution=${BINARIES_DISTRIBUTION}"
    fi
    if [[ -n "$BINARIES_CPU_ARCH" ]]
    then
       BINARIES_OPTIONS+=" --cpu=${BINARIES_CPU_ARCH}"
    fi
    if [[ -n "$BINARIES_MCI_SUCCESSFUL_TASKS" ]]
    then
       BINARIES_OPTIONS+=" --tasks ${BINARIES_MCI_SUCCESSFUL_TASKS}"
    fi
    echo ${BINARIES_OPTIONS}
}

function do_git_tasks() {
    if [ "$FETCH_BINARIES" != true ]
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
        BINARIES_OPTIONS=$(determine_get_binaries_options)
        echo "Getting Binaries with options: ${BINARIES_OPTIONS}"
        if [ $THIS_PLATFORM == 'Windows' ]
        then
                eval $(python `cygpath -w ${MPERFPATH}/util/get-mongodb-binaries` --dir `cygpath -w "${DLPATH}"` ${BINARIES_OPTIONS})
        else
                eval $(python ${MPERFPATH}/util/get-mongodb-binaries --dir "${DLPATH}" ${BINARIES_OPTIONS})
        fi
        chmod +x ${DLPATH}/${MONGOD}
        if [ ! -x ${DLPATH}/${MONGOD} ]
        then
            echo "check permissions or existence of $MONGOD in $DLPATH"
            exit 7
        fi
        cp -p ${DLPATH}/${MONGOD} ${BUILD_DIR}
        cp -p ${DLPATH}/${MONGO} ${BUILD_DIR}

    fi

    BINHASH=""
    BINVERSION=""
    BINHASH=$(${DLPATH}/${MONGOD} --version | egrep git.version|perl -pe '$_="$1" if m/git.version:\s(\w+)/')
    BINVERSION=$(${DLPATH}/${MONGOD} --version | egrep db.version|perl -pe '$_="$1" if m/db.version\sv(.+)$/')

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

function run_build() {
    if [ "$FETCH_BINARIES" != true ]
    then
        cd $BUILD_DIR
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
        if [ -x "$(which numactl)" ]
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

    ENGINE_TEST=$(${DLPATH}/${MONGOD} --storageEngine=mmapv1 --version) > /dev/null 2>&1
    NO_ENGINES=$?

    SE_MMAP="mmapv1"
    if [ "$NO_ENGINES" == "0" ]
    then
        SE_WT="wiredTiger"
    fi
}

function clear_caches() {
    if [ $THIS_PLATFORM == 'Linux' ]
    then
        ${SUDO} bash -c "echo 3 > /proc/sys/vm/drop_caches"
    fi
}

function determine_benchrun_options() {
    BENCHRUN_OPTIONS=""
    BENCHRUN_OPTIONS+=" --host=${TEST_HOST}"
    BENCHRUN_OPTIONS+=" --port=${TEST_PORT}"
    BENCHRUN_OPTIONS+=" --rhost ${RHOST}"
    BENCHRUN_OPTIONS+=" --rport ${RPORT}"
    BENCHRUN_OPTIONS+=" -t ${THREAD_COUNTS}"
    BENCHRUN_OPTIONS+=" -s ${SHELLPATH}"
    BENCHRUN_OPTIONS+=" -f ${TESTCASES}"
    BENCHRUN_OPTIONS+=" --trialTime ${TEST_TRIALS_TIME}"
    BENCHRUN_OPTIONS+=" --trialCount ${TEST_TRIALS_COUNT}"
    BENCHRUN_OPTIONS+=" --writeCmd ${TEST_WRITE_COMMAND}"
    BENCHRUN_OPTIONS+=" --testFilter ${TEST_TAGS_FILTER}"
    BENCHRUN_OPTIONS+=" -w ${TEST_WRITE_CONCERN}"
    BENCHRUN_OPTIONS+=" -j ${TEST_JOURNAL_CONFIRM}"


    if [ "$FETCH_BINARIES" != true ]
    then
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            BENCHRUN_OPTIONS+=" --mongo-repo-path \"`cygpath -w ${BUILD_DIR}`\""
        else
            BENCHRUN_OPTIONS+=" --mongo-repo-path \"${BUILD_DIR}\""
        fi
    fi
    if [ -n "$TEST_REPLSET" ]
    then
        BENCHRUN_OPTIONS+=" --replset ${TEST_REPLSET}"
    fi

    if [ -n "$TEST_REPLSET" ]
    then
        BENCHRUN_OPTIONS+=" --replset ${TEST_REPLSET}"
    fi

    if [ -n "${TOPOLOGY_NAME}" ]
    then
        BENCHRUN_OPTIONS+=" --topology ${TOPOLOGY_NAME}"
    fi

    if [ "${SUBMIT_TO_DYNO}" != "true" ]
    then
        BENCHRUN_OPTIONS+=" --dyno false"
    else
        BENCHRUN_OPTIONS+=" --dyno true"
    fi
    echo ${BENCHRUN_OPTIONS}
}



function determine_mongod_options()
{
        MONGOD_OPTIONS="--logpath ${MONGOD_LOG_PATH}"
        if [ "$NO_ENGINES" == "0" ]
        then
            MONGOD_OPTIONS+=" --storageEngine=${STORAGE_ENGINE}"
        fi

        if [ $STORAGE_ENGINE == "mmapv1" ]
        then
            MONGOD_OPTIONS+=" --syncdelay ${DISK_SYNC_DELAY}"
        elif [ "$STORAGE_ENGINE" == "$SE_WT" ]
        then
            ${DLPATH}/${MONGOD} --wiredTigerEngineConfig "checkpoint=(wait=${DISK_SYNC_DELAY})" --version > /dev/null 2>&1
            WTEC_TEST=$?
            ${DLPATH}/${MONGOD} --wiredTigerCheckpointDelaySecs ${DISK_SYNC_DELAY} --version > /dev/null 2>&1
            WTCDS_TEST=$?
            if [ "$WTEC_TEST" == "0" ]
            then
                MONGOD_OPTIONS+=" --wiredTigerEngineConfig checkpoint=(wait=${DISK_SYNC_DELAY})"
            fi
            if [ "$WTCDS_TEST" == "0" ]
            then
                MONGOD_OPTIONS+=" --wiredTigerCheckpointDelaySecs ${DISK_SYNC_DELAY}"
            fi
        else
            EXTRA=""
        fi
        echo ${MONGOD_OPTIONS}
}


function determine_mmsa_mongod_options()
{
        MMSA_MONGOD_OPTIONS='"storage":{'
        if [ "$NO_ENGINES" == "0" ]
        then
            MMSA_MONGOD_OPTIONS+="\"engine\":\"${STORAGE_ENGINE}\","
        fi

        if [ $STORAGE_ENGINE == "mmapv1" ]
        then
            MMSA_MONGOD_OPTIONS+="\"syncPeriodSecs\":${DISK_SYNC_DELAY}"
        elif [ "$STORAGE_ENGINE" == "$SE_WT" ]
        then
            ${DLPATH}/${MONGOD} --wiredTigerEngineConfig "checkpoint=(wait=${DISK_SYNC_DELAY})" --version > /dev/null 2>&1
            WTEC_TEST=$?
            ${DLPATH}/${MONGOD} --wiredTigerCheckpointDelaySecs ${DISK_SYNC_DELAY} --version > /dev/null 2>&1
            WTCDS_TEST=$?
            if [[ "$WTEC_TEST" == "0" || "$WTCDS_TEST" == "0" ]]
            then
                MMSA_MONGOD_OPTIONS+="\"wiredTiger\":{\"engineConfig\":\"checkpoint=(wait=${DISK_SYNC_DELAY})\"}"
            fi
        else
            EXTRA=""
        fi
        MMSA_MONGOD_OPTIONS+='}'
        echo ${MMSA_MONGOD_OPTIONS}
}

function determine_mmsa_options_file()
{

    MMSA_MONGOD_OPTIONS=$(determine_mmsa_mongod_options)
    MMSA_TEMP_CONFIG=$(mktemp -t mongo-perf-mmsa.XXXXXXXXXX)
    cat <<EOF > $MMSA_TEMP_CONFIG
    {
        "template": "${TOPOLOGY}",
        "config_file_location": "${MMSA_CONFIG_FILE}",
        "download_path":"${MMSA_DOWNLOAD_ROOT}",
        "log_path":"${MMSA_LOG_ROOT}",
        "data_path":"${MMSA_DATA_ROOT}",
        "pid_dir_path":"${MMSA_PID_ROOT}",
        "download_url":"${MMSA_BINARIES_DOWNLOAD_LINK}",
        "download_os":"${MMSA_BINARIES_OS}",
        "download_bits":"${MMSA_BINARIES_BITS}",
        "download_git_hash":"${BINHASH}",
        "download_version":"${BINVERSION}",
        "mongod_options":{
            ${MMSA_MONGOD_OPTIONS}
        }
    }
EOF
    echo ${MMSA_TEMP_CONFIG}
}

function determine_benchrun_label() {
    BASE_BENCHRUN_LABEL="${THIS_PLATFORM}-${THIS_HOST}"
    if [ -n "${PLATFORM_SUFFIX}" ]
    then
        BASE_BENCHRUN_LABEL+="-${PLATFORM_SUFFIX}"
    fi
    BASE_BENCHRUN_LABEL+="-${LAST_HASH:0:7}-${STORAGE_ENGINE}"
    if [ -n "${TOPOLOGY_NAME}" ]
    then
        BASE_BENCHRUN_LABEL+="-${TOPOLOGY_NAME}"
    fi
    echo ${BASE_BENCHRUN_LABEL}
}

function run_benchrun() {

    clear_caches
    ${BR_START} python benchrun.py -l ${BASE_BENCHRUN_LABEL} ${BR_OPTIONS}

    # Run with multi-DB
    if [ ! -z "$MPERF_MULTI_DB" ]
    then
        clear_caches
        ${BR_START} python benchrun.py -l "${BASE_BENCHRUN_LABEL}-multidb${MPERF_MULTI_DB}" ${BR_OPTIONS} -m ${MPERF_MULTI_DB}
    fi

    # Run with multi-collection.
    if [ ! -z "$MPERF_MULTI_COLL" ]
    then
        clear_caches
        ${BR_START} python benchrun.py -l "${BASE_BENCHRUN_LABEL}--multicoll${MPERF_MULTI_COLL}" ${BR_OPTIONS} --multicoll ${MPERF_MULTI_COLL}
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
        SERVER_OPTIONS=$(determine_mongod_options)
        # Kick off a mongod process.
        cd $BUILD_DIR || exit 1
        if [ $THIS_PLATFORM == 'Windows' ]
        then
            rm -rf `cygpath -u $DBPATH`/*
            (./${MONGOD} --dbpath ${DBPATH} ${SERVER_OPTIONS} &)
        else
            rm -rf $DBPATH/*
            echo ${MONGOD_START} ./${MONGOD} --dbpath ${DBPATH} ${SERVER_OPTIONS} --fork
            ${MONGOD_START} ./${MONGOD} --dbpath ${DBPATH} ${SERVER_OPTIONS} --fork
        fi
        # TODO: doesn't get set properly with --fork ?
        MONGOD_PID=$!


        cd $MPERFPATH
        TIME="$(date "+%Y%m%d_%H:%M")"

        # list of testcase definitions
        TESTCASES=$(find testcases -name "*.js")

        # list of thread counts to run (high counts first to minimize impact of first trial)
        determine_bench_threads

        BR_OPTIONS=$(determine_benchrun_options)
        BASE_BENCHRUN_LABEL=$(determine_benchrun_label)

        run_benchrun

        # Kill the mongod process and perform cleanup.
        kill -n 9 ${MONGOD_PID}
        pkill -9 ${MONGOD}         # kills all mongod processes -- assumes no other use for host
        pkill -9 mongod            # needed this for loitering mongod executable w/o .exe extension?
        sleep 5
        rm -rf ${DBPATH}/*
    done
}

function run_mongo_perf_mmsa() {
    # Setup
    determine_storage_engines
    shopt -s nullglob; for TOPOLOGY in ${MMSA_TEMPLATE_DIR}/*.json
    do
        determine_cpu_masks
        determine_process_invocation
       # Run for mulltiple storage engines
        for STORAGE_ENGINE in $SE_WT $SE_MMAP
        do
            MMSA_OPTIONS_FILE=$(determine_mmsa_options_file)
            eval $(python ${MPERFPATH}/util/mms-automation-config --optionsfile ${MMSA_OPTIONS_FILE})
            sleep 15

            cd $MPERFPATH
            TIME="$(date "+%Y%m%d_%H:%M")"

            # list of testcase definitions
            TESTCASES=$(find testcases -name "*.js")

            # list of thread counts to run (high counts first to minimize impact of first trial)
            determine_bench_threads

            TOPOLOGY_NAME=$(basename $TOPOLOGY)
            TOPOLOGY_NAME=${TOPOLOGY_NAME%.json}

            BR_OPTIONS=$(determine_benchrun_options)
            BASE_BENCHRUN_LABEL=$(determine_benchrun_label)

            run_benchrun

            # shutdown the server and clean up the files
            eval $(python ${MPERFPATH}/util/mms-automation-config --optionsfile ${MMSA_OPTIONS_FILE} --shutdown)
            unlink ${MMSA_OPTIONS_FILE}
        done
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
            if [ "${MMS_AUTOMATION}" != "true" ]
            then
                run_mongo_perf
            else
                run_mongo_perf_mmsa
            fi
        fi
    fi
    if [ -e $BREAK_PATH ]
    then
        break
    fi
done
