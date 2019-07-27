import requests
import urllib3
urllib3.disable_warnings()

USER_AGENT = "Mozilla Firefox Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:53.0) Gecko/20100101 Firefox/53.0"


def request_patch(self, *args, **kwargs):
    kwargs.setdefault('timeout', 5)
    return self.request_orig(*args, **kwargs)


# Monkey-patch because pyoembed won't allow configuring it
setattr(requests.sessions.Session, 'request_orig', requests.sessions.Session.request)
requests.sessions.Session.request = request_patch


session = requests.Session()
session.verify = False
session.headers.update({'User-Agent': USER_AGENT})
