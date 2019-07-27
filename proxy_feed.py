import hashlib

from lxml.builder import E
from social_media_feed import process_html, element_to_string
from requests_session import session
from cache import cache

from lxml import etree


def cached_process_html(text, url):
    key = hashlib.sha1(text.encode('utf-8')).hexdigest()
    if key in cache:
        return cache[key]

    res = element_to_string(process_html(text, url))
    cache.set(key, res, expire=3*24*60*60)
    return res


def proxy_feed(url):
    res = session.get(url)
    res.raise_for_status()
    tree = etree.fromstring(res.content)
    for desc in tree.findall('.//description'):
        new_desc = E.description(cached_process_html(desc.text, url), **desc.attrib)
        desc.getparent().replace(desc, new_desc)
    return etree.tostring(tree, xml_declaration=True, encoding="utf-8").decode('utf-8')


if __name__ == '__main__':
    print(proxy_feed('http://feeds.weblogssl.com/xataka2'))
