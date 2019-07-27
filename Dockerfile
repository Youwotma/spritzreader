FROM python:3-alpine

RUN apk add --update --no-cache --virtual py3-lxml py3-pillow

ADD . /app
RUN pip install -r /app/requirements.txt

CMD ["/app/docker_entrypoint"]
