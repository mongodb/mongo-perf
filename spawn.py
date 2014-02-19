import commands
import ctypes
import multiprocessing
import os
import signal
import socket
import subprocess
import sys
import time

def getNumCPU():
	return multiprocessing.cpu_count()

def buildMongod():
	options = "-j" + str(getNumCPU())
	print(options)

	if os.name == "nt":
		### XXX: find scons path reliably, don't hardcode
		scons_path = "c:\Python27\Scripts\scons.py"
		flags = '--64'
		target = "mongod.exe"
		scons_cmd = ["python", scons_path, flags, options, target]
	else:
		scons_path = "scons"
		target = "mongod"
		scons_cmd = [scons_path, options, target]

	scons_proc = subprocess.Popen(scons_cmd)
	scons_proc.wait()
	if scons_proc.returncode != 0:
		print("something bad happened in scons")

def spawnMongod():
	### XXX: Allow to specify where the db should sit, etc..
	if os.name == "nt":
		dbpath = os.getcwd() + "\db"
		dbex = os.getcwd() + "mongod.exe"
	else:
		dbpath = os.getcwd() + "/db"
		dbex = os.getcwd() + "/mongod"

	if not os.path.exists(dbpath):
		os.mkdir(dbpath)

	mongo_cmd = dbex + " --dbpath " + dbpath

	if os.name == "nt":
		mongod_proc = subprocess.Popen(mongo_cmd,
						#stdout =open(os.devnull, "w"))
						stdout = sys.stdout)
	else:
		mongod_proc = subprocess.Popen(mongo_cmd,
						shell=True,
						#stdout =open(os.devnull, "w"))
						stdout = sys.stdout)

	# XXX: mongod_proc.wait() CHECKCALL?
	# Check if actually mongod came up
	round = 300;
	while (round > 0):
		try:
			sock = socket.socket()
        		sock.setsockopt(socket.IPPROTO_TCP, 
					socket.TCP_NODELAY, 1)
        		sock.settimeout(1)
			### XXX: Do not hardcode port number, for god's sake
        		sock.connect(("localhost", 27017))
        		sock.close()
			break
		except Exception, e:
			time.sleep(1)
			round -= 1
	if round != 0:
		return (mongod_proc.pid)
	return (None)

def killMongod(mongod_pid):
	## For some superobscure reason Windows do not provide SIGKILL.
	## Go for SIGTERM and try to be happy with that.
	if os.name == "nt":
		kernel32 = ctypes.windll.kernel32
		handle = kernel32.OpenProcess(1, 0, mongod_pid)
		kernel32.TerminateProcess(handle, 0)
	else:
		os.kill(int(mongod_pid), signal.SIGKILL)
	isShutdown = False
	round = 300
	while (round > 0):
		try:
			sock = socket.socket()
			sock.setsockpot(socket.IPPROTO_TCP,
					socket.TCP_NODELAY, 1)
			sock.settimeout(1)
			sock.connect(("localhost", 27107))
			sock.close()
		except Exception, e:
			time.sleep(1)
			round -= 1
			isShutdown = True
			break
	if isShutdown:
		print("Killed mongod\n")
		return (0)
	else:
		print("Unable to kill mongod\n")
		return (-1)

def checkNew():
	isNew = True

	if os.name == "nt":
		mongodirpath = "\mongo"
	else:
		mongodirpath = "/mongo"

	if os.path.exists(os.getcwd() + mongodirpath):
		print("mongo checkout already there, updating..")
		isNew = False
	return (isNew)



def fetchMongod():
	mongo_fetch = "git clone https://github.com/mongodb/mongo"
	
	while True:
		mongo_proc = subprocess.Popen(mongo_fetch,
				shell=True, stdout=sys.stdout)
		mongo_proc.wait()
		if mongo_proc.returncode != 0:
			### XXX: be more precise about the error
			print("clone not working")
			return (process.returncode)
		return (0)

def updateAndBuild():
	lastrev = ""

	if os.name == "nt":
		mongodirpath = "\mongo"
	else:
		mongodirpath = "/mongo"

	os.chdir(os.getcwd() + mongodirpath)
	while True:
		process = subprocess.Popen("git pull",
				shell=True, stdout=sys.stdout)
		process.wait()
		if process.returncode != 0:
			print ("pull not working")
			continue
		
		process = subprocess.Popen("git rev-parse HEAD",
				shell=True,
				stdout=subprocess.PIPE)
		process.wait()
		rev, err = process.communicate()
		if rev != lastrev:
			lastrev = rev
			buildMongod()
			mongod_pid = spawnMongod()
			if mongod_pid == None:
				print("failed to spawn mongod")
			ret = killMongod(mongod_pid)
			if ret == -1:
				print("failed to kill mongod")
				sys.exit()
		else:
			time.sleep(10)

def main():
	# Get cwd
	isNew = checkNew()

	if os.name == "nt":
		mongodirpath = "\mongo"
	else:
		mongodirpath = "/mongo"

	if isNew:
		ret = fetchMongod()
		if ret != 0:
			return
		os.chdir(os.getcwd() + mongodirpath)
	else:
		updateAndBuild()

if __name__ == "__main__":
	main()
