# -*- mode: python; -*-
import os

v8root = "../../v8/"
if not os.path.exists( v8root ):
    v8root = "../v8/"

env = Environment()

if 'darwin' == os.sys.platform:
    env.Append(CPPPATH=['/opt/local/include'])
    env.Append(LIBPATH=['/opt/local/lib'])

print( v8root )
env.Append(LIBPATH=[v8root])
env.Append(CPPPATH=[v8root+"/include"])

env.Append( CPPFLAGS=" -m32 " )

conf = Configure( env )
libs = [ "mongoclient" , "v8" ]
boostLibs = [ "thread" , "filesystem" ]

def checkLib( n ):
    if conf.CheckLib( n ):
        return True
    print( "Error: can't find library: " + str( n ) )
    Exit(-1)
    return False

for x in libs:
    checkLib( x )

def makeBoost( x ):
    # this will have to get more complicated later
    return "boost_" + x + "-mt";

for x in boostLibs:
    checkLib( makeBoost( x ) )

conf.CheckLib( makeBoost( "system" ) )

env = conf.Finish()

files = [ "wrapper.cpp" ]

env.Program( "shell" , files + [ "utils.cpp" , "shell.cpp" ] )
