FROM python:3-alpine

ADD . /app
RUN pip install -r /app/requirements.txt

CMD ["/app/docker_entrypoint"]
