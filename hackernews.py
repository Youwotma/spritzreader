from lxml.builder import E

from cache import cache
from social_media_feed import render_feed, process_html, extract_main_content
from requests_session import session


def parse_comment(comment):
    children = [parse_comment(child) for child in comment['children'] if child['text']]

    return {
        'author': comment['author'],
        'author_url': 'https://new.ycombinator.com/user?id=%s' % (comment['author']),
        'content': process_html(comment['text'], 'https://news.ycombinator.com'),
        'children': children
    }


@cache.memoize(expire=2*60*60)
def query_comments(id):
    url = f"http://hn.algolia.com/api/v1/items/{id}"
    res = session.get(url)
    res.raise_for_status()
    return res.json()


def get_comments(permalink):
    data = query_comments(permalink)
    return [parse_comment(comment) for comment in data['children'] if comment["text"]]


def render_comment(comment):
    content = comment['content']
    link = E.span(E.a(comment['author'], href=comment['author_url']), ': ')
    parent = content.find('./p')
    link.tail = parent.text
    parent.text = ''
    parent.insert(0, link)

    return E.blockquote(
        content,
        *[render_comment(subcomment) for subcomment in comment.get('children', [])]
    )


def hackernews_feed(threshold):
    res = session.get('https://hn.algolia.com/api/v1/search?tags=front_page')
    res.raise_for_status()
    data = res.json()

    posts = []
    for post in data['hits']:
        if post.get('points', -1) < threshold:
            continue

        if post['url']:
            content = extract_main_content(post['url'])
        else:
            content = process_html(post['story_text'], 'news.ycombinator.com')

        posts.append({
            'url': post['url'],
            'title': post['title'],
            'author': '%s@news.ycombinator.com (%s)' % (post['author'], post['author']),
            'content': E.div(
                content,
                E.hr,
                E.a('Comments', href='https://news.ycombinator.com/item?id=%s' % post['objectID']),
                '(%s)' % post['num_comments'],
                E.hr,
                *[render_comment(comment) for comment in get_comments(post['objectID'])]
            )
        })

    return render_feed('Hacker News feed', 'https://news.ycombinator.com', posts)


if __name__ == '__main__':
    print(hackernews_feed(15))
