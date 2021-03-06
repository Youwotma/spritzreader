from flask import Flask, redirect, request, session, send_file, jsonify, Response
from feedly import FeedlyClient
from config import FEEDLY_CLIENT_ID, FEEDLY_SANDBOX, FEEDLY_REDIRECT_URI, FEEDLY_CLIENT_SECRET, SECRET_KEY
from proxy import proxy
import reddit
import hackernews
import product_hunt
import proxy_feed

import time
import hashlib
import binascii
import os

app = Flask(__name__)


@app.route("/")
def hello():
    if "code" in request.args:
        feedly = get_feedly_client()
        res_access_token = feedly.get_access_token(FEEDLY_REDIRECT_URI, request.args['code'])
        session.permanent = True
        session['id'] = res_access_token['id']
        session['access'] = res_access_token['access_token']
        session['refresh'] = res_access_token['refresh_token']
        session['expires'] = time.time() + res_access_token['expires_in'] - 600
        return redirect("/")

    if "access" not in session:
        return "You are not logged in. <a href='/auth'>Login with feedly</a>"
    return send_file("./static/index.html")


@app.route('/idbtest')
def itest():
    return send_file("./static/idbtest.html")


def get_feedly_client():
    if "access" in session:
        if session.get('expires', 0) < time.time():
            # Expired token...
            del session['access']
            return get_feedly_client()
        else:
            return FeedlyClient(
                token=session['access'],
                client_id=FEEDLY_CLIENT_ID,
                client_secret=FEEDLY_CLIENT_SECRET,
                sandbox=FEEDLY_SANDBOX
            )
    else:
        client = FeedlyClient(
            client_id=FEEDLY_CLIENT_ID,
            client_secret=FEEDLY_CLIENT_SECRET,
            sandbox=FEEDLY_SANDBOX
        )
        if 'refresh' in session:
            print("Refresh access token")
            res_refresh = client.refresh_access_token(session['refresh'])
            session['access'] = res_refresh['access_token']
            session['expires'] = time.time() + res_refresh['expires_in'] - 600
            return get_feedly_client()
        else:
            return client


@app.route("/feeds")
def feeds():
    fl = get_feedly_client()
    return jsonify(res=fl.get_user_subscriptions(fl.token))


def hasharticle(article):
    hex = hashlib.sha1(article['id'].encode('utf-8')).hexdigest()[:12]
    return binascii.b2a_base64(binascii.unhexlify(hex)).strip()


def get_feed(feed):
    fl = get_feedly_client()
    url = "user/" + session['id'] + feed
    args = request.args.to_dict()
    have = args.pop('have', '').split(',')
    res = fl.get_feed_content(fl.token, url, args)
    res['not_included'] = [hasharticle(r) for r in res['items'] if hasharticle(r) in have]
    res['items'] = [r for r in res['items'] if hasharticle(r) not in have]
    return jsonify(res=res)


@app.route("/feed")
def feed():
    return get_feed("/category/global.all")


@app.route("/starred")
def starred():
    return get_feed("/tag/global.saved")


@app.route("/settokens", methods=['POST'])
def settoken():
    session['id'] = request.form['id']
    session['access'] = request.form['token']
    return redirect("/")


@app.route("/mark_read", methods=["POST"])
def mark_read():
    fl = get_feedly_client()
    return jsonify(res=fl.mark_article_read(fl.token, [request.args['item']]).status_code)


@app.route("/star", methods=["POST"])
def star():
    fl = get_feedly_client()
    return jsonify(res=fl.save_for_later(fl.token, session['id'], request.args['item']).status_code)


@app.route("/unstar", methods=["POST"])
def unstar():
    fl = get_feedly_client()
    return jsonify(res=fl.save_for_later(fl.token, session['id'], request.args['item'], False).status_code)


@app.route("/auth")
def auth():
    feedly = get_feedly_client()
    # Redirect the user to the feedly authorization URL to get user code
    code_url = feedly.get_code_url(FEEDLY_REDIRECT_URI)
    return redirect(code_url)


@app.route("/proxy")
def _proxy():
    [content, mime] = proxy(request.args['url'])
    return Response(content, mimetype=mime)


@app.route("/proxy_feed")
def _proxy_feed():
    content = proxy_feed.proxy_feed(request.args['url'])
    return Response(content, mimetype='application/rss+xml')


@app.route("/r/<subreddit>.xml")
def reddit_feed(subreddit):
    content = reddit.reddit_feed(subreddit, int(request.args.get('votes', 0)))
    return Response(content, mimetype='application/rss+xml')


@app.route("/hackernews.xml")
def hackernews_feed():
    content = hackernews.hackernews_feed(int(request.args.get('votes', 0)))
    return Response(content, mimetype='application/rss+xml')


@app.route("/product_hunt.xml")
def product_hunt_feed():
    content = product_hunt.product_hunt_feed(int(request.args.get('votes', 0)))
    return Response(content, mimetype='application/rss+xml')


@app.route("/logout")
def logout():
    for k in 'access', 'refresh', 'expires', 'id':
        if k in session:
            del session[k]
    return redirect("/")


app.secret_key = SECRET_KEY

if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get('PORT', 8080)), host='0.0.0.0')
