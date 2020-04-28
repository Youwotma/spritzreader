FROM python:3.7-alpine

RUN apk add --update --no-cache py3-lxml
ENV PYTHONPATH /usr/lib/python3.7/site-packages:$PYTHONPATH

ADD . /app
RUN pip install -r /app/requirements.txt

CMD ["/app/docker_entrypoint"]
