# Same as official mongodb docker images
FROM ubuntu:bionic

RUN groupadd -r mongo-shell && useradd -r -g mongo-shell mongo-shell

# Env
ARG MONGO_PACKAGE=mongodb-org
ARG MONGO_REPO=repo.mongodb.org
ENV MONGO_PACKAGE=${MONGO_PACKAGE} MONGO_REPO=${MONGO_REPO}

ENV MONGO_MAJOR 4.2

# Install
RUN apt-get update -y \
    && apt-get install -y gnupg wget

RUN wget -qO - "https://www.mongodb.org/static/pgp/server-${MONGO_MAJOR}.asc" | apt-key add -
RUN echo "deb [ arch=amd64 ] https://$MONGO_REPO/apt/ubuntu bionic/$MONGO_PACKAGE/$MONGO_MAJOR multiverse" | tee /etc/apt/sources.list.d/${MONGO_PACKAGE}-${MONGO_MAJOR}.list

RUN apt-get update -y \
    &&  apt-get install -y ${MONGO_PACKAGE}-shell python2.7 python-pip \
    && apt-get remove -y gnupg wget \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /workdir

# Install 
COPY requirements.txt .

# Install requirements first to avoid doing this each time there is a change
RUN pip install -r requirements.txt

# Copy source
COPY . .

# Permissions
RUN chown -R mongo-shell:mongo-shell .

USER mongo-shell

ENTRYPOINT [ "/usr/bin/python", "benchrun.py" ]
CMD []