FROM mongo:5.0.8

RUN groupadd -r mongo-shell && useradd -r -g mongo-shell mongo-shell

RUN apt-get update -y \
    &&  apt-get install -y python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /workdir

COPY requirements.txt .

RUN pip3 install -r requirements.txt

COPY . .

RUN chown -R mongo-shell:mongo-shell .

USER mongo-shell

ENTRYPOINT ["python3", "benchrun.py"]
CMD []