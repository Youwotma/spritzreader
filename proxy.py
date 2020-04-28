import requests

from config import CLOUDIMAGE_HOST

s = requests.Session()


def is_image(url):
    res = s.head(url, stream=False)
    mime = res.headers.get('content-type', 'application/octet-stream')
    return mime.lower().startswith('image/')


def proxy(url):
    if url.startswith('https://%s' % CLOUDIMAGE_HOST) or not is_image(url):
        res = s.get(url)
    else:
        template = "https://%s/v7/%s%sw=500&h=1000&func=bound&org_if_sml=1"
        separator = "&" if "?" in url else "?"
        url = template % (CLOUDIMAGE_HOST, url, separator)
        res = s.get(url)
    mime = res.headers.get('content-type', 'application/octet-stream')
    return [res.content, mime]
