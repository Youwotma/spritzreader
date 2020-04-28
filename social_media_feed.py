import requests
import re
import hashlib

from config import CLOUDIMAGE_HOST
from requests_session import session
from cache import cache

from lxml import etree
from lxml.builder import E
from lxml.html import fragment_fromstring
from urllib.parse import quote_plus
from readability import Document
from pyoembed import oEmbed, PyOembedException

KB = 1024


def element_to_string(e):
    return etree.tostring(e, encoding='unicode')


def process_html(html_str, base_url):
    e = fragment_fromstring("<div>%s</div>" % html_str)
    e.make_links_absolute(base_url)

    for img_e in e.findall('.//img'):
        new_img = img(img_e.attrib.get('src', ''))
        img_e.getparent().replace(img_e, new_img)

    for iframe in e.findall('.//iframe'):
        replacement = E.div('Iframe')
        if iframe.attrib.get('src') is not None:
            oembed = extract_oembed(iframe.attrib['src'])
            if oembed is not None:
                replacement.append(oembed)
            else:
                replacement.append(E.a('[target]', href=iframe.attrib['src']))

        iframe.getparent().replace(iframe, replacement)

    return e


def img(orig_url):
    template = "https://%s/v7/%s?w=500&h=1000&func=bound&org_if_sml=1"
    url = template % (CLOUDIMAGE_HOST, quote_plus(orig_url))
    return E.img(src=url)


def extract_imgur(url):
    m = re.match('https?://(i\.imgur\.com|i\.reddituploads\.com|imgur\.com)/', url)

    if m is None:
        return None

    if m.group(1) == 'imgur.com':
        if re.match("https?://imgur\.com/a/", url):
            return E.a('Imgur Album', href=url)
        m = re.match("https?://imgur\.com/([^\/]+)$", url)
        if m:
            return img("https://i.imgur.com/%s" % m.group(1))

        return E.p("UNKNOWN IMGUR URL %s" % url)
    else:
        return img(url)


def extract_oembed(url):
    try:
        data = oEmbed(url)
        if data.get('thumbnail_url') and data.get('type') not in ('link', 'rich'):
            keys = 'title', 'author_name', 'type', 'provider_name'
            description = ", ".join("%s: %r" % (key, data.get(key, '[not set]')) for key in keys)

            return E.div(
                    img(data["thumbnail_url"]),
                    E.p(description)
                   )
    except PyOembedException as e:
        return None


def _extract_main_content(url):
    if not re.match('^https?://', url):
        return E.p('Unsupported schema in url %r' % url)

    oembed = extract_oembed(url)
    if oembed is not None:
        return oembed

    imgur = extract_imgur(url)
    if imgur is not None:
        return imgur

    with session.get(url, stream=True, verify=False) as res:
        res.raise_for_status()
        mime = res.headers.get('content-type', 'application/octet-stream').lower()
        size = 'unknown'

        if mime.startswith('image/'):
            return E.div(
                img(url),
                E.a('Original image', href=url)
            )
        if mime == "text/plain" and len(res.text) < 100 * KB:
            return E.div(res.text)
        if re.match('^(text/html|application/(xhtml\+)?xml)', mime) is not None and len(res.text) < 200 * KB:
            doc = Document(res.text, url=url)
            return E.div(
                     E.h1(doc.title()),
                     process_html(doc.summary(True), url)
                   )
        return E.div("Could not get main content. Mime: %r, Size: %r Status Code: %r" % (mime, size, res.status_code))


@cache.memoize(expire=3*24*60*60)
def extract_main_content_str(url):
    return element_to_string(_extract_main_content(url))


def extract_main_content(url):
    try:
        return etree.fromstring(extract_main_content_str(url))
    except requests.exceptions.RequestException as ex:
        return E.div("RequestException: %r" % ex)


def generate_post(post):
    guid = hashlib.md5(post['url'].encode('utf-8')).hexdigest()
    return E.item(
        E.title(post.get('title', '[no title]')),
        E.link(post['url']),
        E.description(element_to_string(post['content'])),
        E.author(post.get('author', 'nobody@nowhere.com (nobody)')),
        E.guid(guid, isPermaLink="false")
    )


def generate_feed(title, link, posts):
    return E.rss(
        E.channel(
            E.title(title),
            E.description(title),
            E.link(link),
            *[generate_post(post) for post in posts]
        ),
        version="2.0"
    )


def render_feed(*args, **kwargs):
    return etree.tostring(
        generate_feed(*args, **kwargs),
        pretty_print=True,
        xml_declaration=True,
        encoding='utf-8'
    ).decode('utf-8')
