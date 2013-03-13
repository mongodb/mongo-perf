import os
import subprocess
import time
import sys
import socket

class mongod(object):
    def __init__(self, mongod="mongod", port=27017, **kwargs):
        self.kwargs = kwargs
        self.proc = None
        self.mongod = mongod
        self.port = port

    def __enter__(self):
        self.start()

    def __exit__(self, type, value, traceback):
        try:
            self.stop()
        except Exception, e:
            print >> sys.stderr, "error shutting down mongod"
            print >> sys.stderr, e
        return not isinstance(value, Exception)

    def check_mongo_port(self, port=27017):
        sock = socket.socket()
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.settimeout(1)
        sock.connect(("localhost", port))
        sock.close()

    def did_mongod_start(self, port=27017, timeout=300):
        while timeout > 0:
            time.sleep(1)
            try:
                self.check_mongo_port(port)
                return True
            except Exception,e:
                print >> sys.stderr, e
                timeout = timeout - 1
        print >> sys.stderr, "timeout starting mongod"
        return False

    def start(self):
        if self.proc:
            print >> sys.stderr, "probable bug: self.proc already set in start()"
            raise Exception("Failed to start mongod")

        path = os.getcwd() + "/db"
        if os.sys.platform == "win32":
            path = os.getcwd() + "\db"
        argv = ["mkdir", "-p", path]
        subprocess.Popen(argv).communicate()
        argv = [self.mongod, "--port", self.port, "--dbpath", path]
        print >> sys.stdout, "running " + " ".join(argv)
        self.proc = self._start(argv)

        if not self.did_mongod_start(int(self.port)):
            raise Exception("Failed to start mongod")


    def _start(self, argv):
        """In most cases, just call subprocess.Popen(). On windows,
        add the started process to a new Job Object, so that any
        child processes of this process can be killed with a single
        call to TerminateJobObject (see self.stop()).
        """
        proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

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
            job_info['BasicLimitInformation']['LimitFlags'] |= win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            win32job.SetInformationJobObject(
                self.job_object,
                win32job.JobObjectExtendedLimitInformation,
                job_info)

            win32job.AssignProcessToJobObject(self.job_object, proc._handle)

        return proc

    def stop(self):
        if not self.proc:
            print >> sys.stderr, "probable bug: self.proc unset in stop()"
            raise Exception("Failed to stop mongod")
            return
        try:
            if os.sys.platform.startswith( "win" ):
                import win32job
                win32job.TerminateJobObject(self.job_object, -1)
                import time
                # Windows doesn't seem to kill the process immediately, so give it some time to die
                time.sleep(5) 
            else:
                # This actually works
                mongo_executable = os.path.abspath(os.path.join(self.mongod, '..', 'mongo'))
                argv = [mongo_executable, "--port", self.port, "--eval", "db.getSiblingDB('admin').shutdownServer()"]
                proc = subprocess.Popen(argv)
                # This function not available in Python 2.5
                self.proc.terminate()
        except AttributeError:
            from os import kill
            kill(self.proc.pid, 15)
        except Exception, e:
            print >> sys.stderr, "error shutting down mongod"
            print >> sys.stderr, e
            sys.exit(1)

        self.proc.wait()
        sys.stderr.flush()
