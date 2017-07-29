FROM python:2-alpine

ADD . /app
RUN pip install -r /app/requirements.txt

CMD ["/app/docker_entrypoint"]
