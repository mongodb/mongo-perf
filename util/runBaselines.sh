#!/bin/bash
#
touch ~/build-perf
util/benchrun_daemon.sh r2.4.10 || exit 1
util/benchrun_daemon.sh r2.4.11 || exit 1
util/benchrun_daemon.sh r2.6.0 || exit 1
util/benchrun_daemon.sh r2.6.1 || exit 1
util/benchrun_daemon.sh r2.6.2 || exit 1
util/benchrun_daemon.sh r2.6.3 || exit 1
util/benchrun_daemon.sh r2.6.4 || exit 1
util/benchrun_daemon.sh r2.7.0 || exit 1
util/benchrun_daemon.sh r2.7.1 || exit 1
util/benchrun_daemon.sh r2.7.2 || exit 1
util/benchrun_daemon.sh r2.7.3 || exit 1
util/benchrun_daemon.sh r2.7.4 || exit 1
util/benchrun_daemon.sh r2.7.5 || exit 1
rm -f ~/build-perf

