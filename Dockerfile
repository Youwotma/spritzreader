FROM python:3-alpine

RUN apk add --update --no-cache --virtual .build-deps g++ python-dev libxml2 libxml2-dev libxslt-dev jpeg-dev zlib-dev freetype-dev lcms2-dev openjpeg-dev tiff-dev tk-dev tcl-dev harfbuzz-dev fribidi-dev

ADD . /app
RUN pip install -r /app/requirements.txt

CMD ["/app/docker_entrypoint"]
