# -*- mode: python; -*-
import os

env = Environment()

cpp_flags = ['-g']
link_flags = ['-g']

if not 'darwin' == os.sys.platform:
    cpp_flags.extend(['-O2', '-pthread'])
    link_flags.append('-pthread')

env.Append(CPPFLAGS=cpp_flags)
env.Append(LINKFLAGS=link_flags)

if 'darwin' == os.sys.platform:
    if os.path.exists('/opt/local/include'):
        env.Append(CPPPATH=['/opt/local/include'])
    if os.path.exists('/opt/local/lib'):
        env.Append(LIBPATH=['/opt/local/lib'])

env.Append(CPPPATH=['mongo-cxx-driver/src'])
env.Append(CPPPATH=['mongo-cxx-driver/src/mongo'])
env.Append(LIBPATH=['mongo-cxx-driver'])

conf = Configure( env )
libs = ["mongoclient",
        "boost_graph",
        "boost_thread",
        "boost_filesystem",
        'boost_program_options',
        'boost_system']

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

env.Program(target = './benchmark', source = 'core/benchmark.cc')
env.Program('bench-report', ["report/report.cc",
                             "report/CSVFormatter.cc",
                             "report/Formatter.cc"])
