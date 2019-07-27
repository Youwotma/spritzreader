from lxml.builder import E

from config import PH_KEY
from cache import cache
from social_media_feed import render_feed, process_html, extract_main_content
from requests_session import session

API_PATH = 'https://api.producthunt.com/v1/'


def api_request(endpoint):
    res = session.get(f'{API_PATH}{endpoint}', headers={
        'Accept': 'application/json',
        'Authorization': f'Bearer {PH_KEY}'
    })
    res.raise_for_status()
    return res.json()


def parse_comment(comment):
    children = [parse_comment(child) for child in comment['child_comments'] if child.get('body')]

    return {
        'author': comment['user']['name'],
        'author_url': comment['user']['profile_url'],
        'content': process_html(comment['body'], 'https://producthunt.com'),
        'children': children
    }


@cache.memoize(expire=2*60*60)
def query_comments(id):
    return api_request(f'posts/{id}/comments')


def get_comments(id):
    data = query_comments(id)
    return [parse_comment(comment) for comment in data['comments'] if comment.get('body')]


def render_comment(comment):
    content = comment['content']
    link = E.span(E.a(comment['author'], href=comment['author_url']), ': ')
    link.tail = content.text
    content.text = ''
    content.insert(0, link)

    return E.blockquote(
        content,
        *[render_comment(subcomment) for subcomment in comment.get('children', [])]
    )


@cache.memoize(expire=3*24*60*60)
def get_real_url(redirect_url):
    r = session.get(redirect_url, allow_redirects=False)
    r.raise_for_status()
    return r.headers.get('Location') or redirect_url


def product_hunt_feed(threshold):
    data = api_request('posts')

    posts = []
    for post in data['posts']:
        if post.get('votes_count', -1) < threshold:
            continue

        url = get_real_url(post['redirect_url'])
        content = extract_main_content(url)
        title = ': '.join([post[k] for k in ('name', 'tagline') if len(post.get(k) or '')])

        posts.append({
            'url': url,
            'title': title,
            'author': '%s@producthunt.com (%s)' % (post['user']['name'], post['user']['name']),
            'content': E.div(
                content,
                E.hr,
                E.a('Comments', href=post['discussion_url']),
                '(%s)' % post['comments_count'],
                E.hr,
                *[render_comment(comment) for comment in get_comments(post['id'])]
            )
        })

    return render_feed('Product Hunt feed', 'https://producthunt', posts)


if __name__ == '__main__':
    print(product_hunt_feed(15))
