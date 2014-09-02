import os
import time

from fabric.api import task, env, run, sudo

env.use_ssh_config = True
env.forward_agent = True

git_repo = 'https://github.com/mongodb/mongo-perf'
env.hosts = ['qconner@mongo-perf-ui.vpc3.10gen.cc']

base_dir = '/opt/10gen/mongo-perf-ui'
current_link = os.path.join(base_dir, 'current')
releases_dir = os.path.join(base_dir, 'releases')

datetime_format = '%Y%m%d%H%M%S'

@task
def deploy():
    deploy_dir = os.path.join(releases_dir, time.strftime(datetime_format))
    requirements_file = os.path.join(deploy_dir, 'requirements.txt')
    virtualenv_dir = os.path.join(deploy_dir, 'venv')
    virtualenv_pip = os.path.join(virtualenv_dir, 'bin/pip')

    # clone the repo
    run('git clone {0} {1}'.format(git_repo, deploy_dir))

    # fix deploy_dir permissions so anyone w/ deploy privs can clean up later
    run('chmod 2775 {0}'.format(deploy_dir))

    # create virtualenv
    run('virtualenv {0}'.format(virtualenv_dir))

    # install requirements in virtualenv
    run('{0} install -r {1}'.format(virtualenv_pip, requirements_file))

    # update the current symlink
    run('ln -sfn {0} {1}'.format(deploy_dir, current_link))

    # restart the service
    sudo('/etc/init.d/mongo-perf-ui restart')
