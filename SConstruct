# -*- mode: python; -*-
import os

env = Environment()

env.Append(CPPFLAGS=['-pthread', '-O3', '-g'])
env.Append(LINKFLAGS=['-pthread', '-g'])

if 'darwin' == os.sys.platform:
    if os.path.exists('/opt/local/include'):
        env.Append(CPPPATH=['/opt/local/include'])
    if os.path.exists('/opt/local/lib'):
        env.Append(LIBPATH=['/opt/local/lib'])

env.Append(CPPPATH=['mongo-cxx-driver/src'])
env.Append(CPPPATH=['mongo-cxx-driver/src/mongo'])
env.Append(LIBPATH=['mongo-cxx-driver'])

conf = Configure( env )
libs = [ "mongoclient",  "boost_thread" , "boost_filesystem" , 'boost_program_options', 'boost_system']

def checkLib( lib ):
    if lib.startswith('boost_'):
        if conf.CheckLib( lib + '-mt' ):
            return True

    if conf.CheckLib( lib ):
        return True

    print( "Error: can't find library: " + str( lib ) )
    Exit(-1)
    return False

for x in libs:
    checkLib( x )

env = conf.Finish()

env.Program(["benchmark.cpp"] )
