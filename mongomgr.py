# Copyright 2013 10gen, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on a1n "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Manages starting and stopping mongod"""

import os
import subprocess
import time
import sys
import socket
import logging
import logging.handlers


class mongod(object):
    def __init__(self, mongod="mongod", logger=None, port=27017, config_path=None, **kwargs):
        self.mongod = mongod
        self.logger = logger
        self.kwargs = kwargs
        self.port = port
        self.proc = None
        self.config_path = config_path

    def __enter__(self):
        """Start mongod
        """
        self.start()

    def __exit__(self, type, value, traceback):
        """Stop mongod
        """
        try:
            self.stop()
        except Exception, e:
            self.logger.error("Error shutting down mongod - {0}".
                            format(e))
        return not isinstance(value, Exception)

    def check_mongo_port(self, port=27017):
        """Tries to connect to mongod on given port
        """
        sock = socket.socket()
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.settimeout(1)
        sock.connect(("localhost", port))
        sock.close()

    def did_mongod_start(self, port=27017, timeout=300):
        """Checks if mongod started
        """
        while timeout > 0:
            time.sleep(1)
            try:
                self.check_mongo_port(port)
                return True
            except Exception, e:
                timeout = timeout - 1
        self.logger.error("Timeout starting mongod")
        return False

    def start(self):
        """Opens a subprocess to start mongod
        """
        if self.proc:
            self.logger.error("Probable bug: self.proc already" \
                                " set in start()")
            raise Exception("Failed to start mongod")

        dbpath = os.getcwd() + "/db"
        logpath = dbpath + "/log.txt"
        os.makedirs(dbpath)
        argv = [self.mongod, "--port",  self.port, "--dbpath",
                dbpath, "--logpath", logpath]
        if self.config_path is not None:
            argv.append("--config")
            argv.append(self.config_path)
        self.proc = self._start(argv)

        if not self.did_mongod_start(int(self.port)):
            raise Exception("Failed to start mongod")

        self.logger.info("Started mongod with args: {0}".
                            format(" ".join(argv)))

    def _start(self, argv):
        """In most cases, just call subprocess.Popen(). On windows,
        add the started process to a new Job Object, so that any
        child processes of this process can be killed with a single
        call to TerminateJobObject (see self.stop()).
        """
        proc = subprocess.Popen(argv, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE)

        if os.sys.platform == "win32":
            # Create a job object with the "kill on job close"
            # flag; this is inherited by child processes (ie
            # the mongod started on our behalf by buildlogger)
            # and lets us terminate the whole tree of processes
            # rather than orphaning the mongod.
            import win32job

            self.job_object = win32job.CreateJobObject(None, '')

            job_info = win32job.QueryInformationJobObject(
                self.job_object, win32job.JobObjectExtendedLimitInformation)
            job_info['BasicLimitInformation'][
                'LimitFlags'] |= win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            win32job.SetInformationJobObject(
                self.job_object,
                win32job.JobObjectExtendedLimitInformation,
                job_info)

            win32job.AssignProcessToJobObject(self.job_object, proc._handle)

        return proc

    def stop(self):
        """Stops a running mongod
        """
        if not self.proc:
            self.logger.error("Probable bug: self.proc already" \
                                " unset in stop()")
            raise Exception("Failed to stop mongod")
            return
        try:
            if os.sys.platform.startswith("win"):
                import win32job
                win32job.TerminateJobObject(self.job_object, -1)
                import time
                # Windows doesn't seem to kill the process immediately, so give
                # it some time to die
                time.sleep(5)
            else:
                # This actually works
                # mongo_executable = os.path.abspath(os.path.join(self.mongod, '..', 'mongo'))
                # argv = [mongo_executable, "--port", self.port, "--eval", "db.getSiblingDB('admin').shutdownServer()"]
                # proc = subprocess.Popen(argv)
                # This function not available in Python 2.5
                self.proc.terminate()
        except AttributeError:
            from os import kill
            kill(self.proc.pid, 15)
        except Exception, e:
            self.logger.error("Error shutting down mongod - {0}".format(e))
            sys.exit(1)

        self.proc.wait()
        sys.stderr.flush()
