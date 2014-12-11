import multiprocessing
import os
import platform
import subprocess


class NumaNotAvailableError(Exception):
    """ Raised when a numa function is called and numactl is not available
    """


class CPUAffinitySetNotAvailableError(Exception):
    """ Raised when unable to set the CPU affinity on a platform
    """


class CPUNode(object):
    def __init__(self, cpu_list):
        self.cpu_list = cpu_list


class NumaNode(CPUNode):
    def __init__(self, node_number, cpu_list, memory_size, memory_free,
                 process_count):
        self.node_number = node_number
        self.cpu_list = cpu_list
        self.memory_size = memory_size
        self.memory_free = memory_free
        self.process_count = process_count


def get_numa_nodes():
    if not is_numa_capable():
        raise NumaNotAvailableError(
            'Numa control is not available on this machine')

    process = subprocess.Popen(['numactl --hardware | grep cpu'], shell=True,
                               stdout=subprocess.PIPE)
    cpu_list = process.communicate()
    process = subprocess.Popen(['numactl --hardware | grep size'], shell=True,
                               stdout=subprocess.PIPE)
    mem_list = process.communicate()
    process = subprocess.Popen(['numactl --hardware | grep free'], shell=True,
                               stdout=subprocess.PIPE)
    mem_free_list = process.communicate()
    cpu_list = str.splitlines(cpu_list[0])
    mem_list = str.splitlines(mem_list[0])
    mem_free_list = str.splitlines(mem_free_list[0])
    node_list = {}
    for index in range(len(cpu_list)):
        node_list[index] = NumaNode(str.split(cpu_list[index])[1],
                                    str.split(cpu_list[index])[3:],
                                    str.split(mem_list[index])[3],
                                    str.split(mem_free_list[index])[3], 0)
    return node_list


def is_numa_capable():
    numa_capable = False
    if _is_linux() and _has_required_utility('numactl'):
        process = subprocess.Popen(['numactl --hardware | grep available'],
                                   shell=True, stdout=subprocess.PIPE)
        test_available = process.communicate()
        test_available = str.splitlines(test_available[0])
        if int(str.split(test_available[0])[1]) > 1:
            numa_capable = True
    return numa_capable


def is_cpu_affinity_settable():
    if _is_linux() and _has_required_utility('taskset'):
        return True
    return False


def get_cores_available():
    if not is_numa_capable():
        cpu_list = range(multiprocessing.cpu_count())
        cpus = {0: CPUNode(cpu_list)}
    else:
        cpus = get_numa_nodes()
    return cpus


def _whereis(program):
    for path in os.environ.get('PATH', '').split(':'):
        if os.path.exists(os.path.join(path, program)) and \
                not os.path.isdir(os.path.join(path, program)):
            return os.path.join(path, program)
    return None


def _has_required_utility(utility):
    required_utility = True
    if _whereis(utility) is None:
        required_utility = False
    return required_utility


def _is_linux():
    return platform.system() == 'Linux'