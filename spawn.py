import commands
import ctypes
import os
import signal
import socket
import subprocess
import sys
import time

def buildMongod():
	print(os.getcwd())
	### XXX: find scons path reliably, don't hardcode
	scons_path = 'c:\Python27\Scripts\scons.py'
	options = '-j8'
	flags = '--64'
	target = 'mongod.exe'
	scons_cmd = ['python', scons_path, flags, options, target]
	scons_proc = subprocess.Popen(scons_cmd)
	scons_proc.wait()
	if process.returncode != 0:
		print("something bad happened in scons")

def spawnMongod():
	### XXX: Allow to specify where the db should sit, etc..
	if not os.path.exists(os.getcwd() + "\db"):
		os.mkdir(os.getcwd() + "\db")
	mongod_proc = subprocess.Popen('mongod.exe --dbpath db/',
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
		return mongod_proc.pid
	return None

def killMongod(mongod_pid):
	## For some superobscure reason Windows do not provide SIGKILL.
	## Go for SIGTERM and try to be happy with that.
	#os.kill(int(mongod_pid), signal.SIGTERM)
	kernel32 = ctypes.windll.kernel32
	handle = kernel32.OpenProcess(1, 0, mongod_pid)
	kernel32.TerminateProcess(handle, 0)
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
		return 0
	else:
		print("Unable to kill mongod\n")
		return -1

# Get cwd
if os.path.exists(os.getcwd() + "\mongo"):
	print("mongo checkout already there, updating..")
	isNew = False
if isNew:
	while True:
		process = subprocess.Popen(
				"git clone https://github.com/mongodb/mongo",
				shell=True, stdout=sys.stdout)
		process.wait()
		if process.returncode != 0:
			### XXX: be more precise about the error
			print("clone not working")
			continue
		else:
			break

	os.chdir(os.getcwd() + "\mongo")
else:
	lastrev = ""
	os.chdir(os.getcwd() + "\mongo")
	while True:
		process = subprocess.Popen("git pull",
				shell=True, stdout=sys.stdout)
		process.wait()
		if process.returncode != 0:
			print ("pull not working")
			continue
		
		process = subprocess.Popen("git rev-parse HEAD", shell=True,
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
