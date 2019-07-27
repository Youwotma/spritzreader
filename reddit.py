from lxml.builder import E

from cache import cache
from social_media_feed import render_feed, process_html, extract_main_content
from requests_session import session

import html


def parse_comment(comment_obj):
    comment = comment_obj['data']
    children = []
    if (comment.get('replies') or {}).get('kind') == 'Listing':
        children = [parse_comment(child) for child in comment['replies']['data']['children'] if child['kind'] == 't1']

    return {
        'author': comment['author'],
        'author_url': 'https://reddit.com/u/%s' % (comment['author']),
        'content': process_html(html.unescape(comment['body_html']), 'https://reddit.com/r/foo/bar'),
        'children': children
    }


@cache.memoize(expire=2*60*60)
def query_comments(permalink):
    url = "https://www.reddit.com%s.json?limit=20" % permalink
    res = session.get(url)
    res.raise_for_status()
    return res.json()


def render_comment(comment):
    content = comment['content']
    link = E.span(E.a(comment['author'], href=comment['author_url']), ': ')
    parent = content.find('./div[1]/*')
    parent = parent if parent.tag.lower() == 'p' else content.find('./div[1]') or content
    link.tail = parent.text
    parent.text = ''
    parent.insert(0, link)

    return E.blockquote(
        content,
        *[render_comment(subcomment) for subcomment in comment.get('children', [])]
    )


def get_comments(permalink):
    data = query_comments(permalink)
    return [parse_comment(comment) for comment in data[1]['data']['children'] if comment['kind'] == 't1']


def reddit_feed(reddit, threshold):
    res = session.get('https://www.reddit.com/r/%s.json' % reddit)
    res.raise_for_status()
    data = res.json()

    posts = []
    for post_obj in data['data']['children']:
        post = post_obj['data']
        if post.get('score', -1) < threshold:
            continue

        if post['is_self']:
            content = process_html(html.unescape(post['selftext_html'] or '[no content]'), post['url'])
        else:
            content = extract_main_content(post['url'])

        posts.append({
            'url': post['url'],
            'title': post['title'],
            'author': '%s@reddit.com (%s)' % (post['author'], post['author']),
            'content': E.div(
                content,
                E.hr,
                E.a('Comments', href='https://reddit.com/%s' % post['permalink']),
                '(%s)' % post['num_comments'],
                E.hr,
                *[render_comment(comment) for comment in get_comments(post['permalink'])]
            )
        })

    return render_feed('Reddit feed for %s' % reddit, 'https://reddit.com/r/%s' % reddit, posts)

if __name__ == '__main__':
    print(reddit_feed('programming', 0))
