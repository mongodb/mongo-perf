# -*- mode: python; -*-
import os

env = Environment()

env.Append(CPPFLAGS=['-pthread', '-O3', '-g'])
env.Append(LINKFLAGS=['-pthread', '-g'])

if 'darwin' == os.sys.platform:
    env.Append(CPPPATH=['/opt/local/include'])
    env.Append(LIBPATH=['/opt/local/lib'])

conf = Configure( env )
libs = [ "mongoclient",  "boost_thread" , "boost_filesystem" , 'boost_program_options', 'boost_system']

def checkLib( lib ):
    if lib.startswith('boost_'):
        if conf.CheckLib( lib + '_mt' ):
            return True

    if conf.CheckLib( lib ):
        return True

    print( "Error: can't find library: " + str( lib ) )
    Exit(-1)
    return False

for x in libs:
    checkLib( x )

env = conf.Finish()

env.Program( "benchmark" , ["benchmark.cpp"] )
