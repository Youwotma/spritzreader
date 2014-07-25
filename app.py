from flask import Flask, redirect, request, session, send_file, jsonify
from feedly import FeedlyClient
from config import FEEDLY_CLIENT_ID, FEEDLY_SANDBOX, FEEDLY_REDIRECT_URI, FEEDLY_CLIENT_SECRET
app = Flask(__name__)

@app.route("/")
def hello():
    req = request
    if "code" in request.args:
        feedly = get_feedly_client()
        res_access_token = feedly.get_access_token(FEEDLY_REDIRECT_URI, request.args['code'])
        session.permanent = True
        session['id'] = res_access_token['id']
        session['access'] =_token=res_access_token['access_token']
        return redirect("/")

    if "access" not in session:
        return "You are not logged in. <a href='/auth'>Login with feedly</a>";


    return send_file("./static/index.html")

def get_feedly_client():
    if "access" in session:
        return FeedlyClient(token=session['access'], sandbox=FEEDLY_SANDBOX)
    else:
        return FeedlyClient(
            client_id=FEEDLY_CLIENT_ID,
            client_secret=FEEDLY_CLIENT_SECRET,
            sandbox=FEEDLY_SANDBOX
        )

@app.route("/feeds")
def feeds():
    fl = get_feedly_client()
    return jsonify(res=fl.get_user_subscriptions(fl.token))

@app.route("/feed")
def feed():
    fl = get_feedly_client()
    return jsonify(res=fl.get_feed_content(fl.token, "user/" + session['id'] + "/category/global.all", request.args.to_dict()))

@app.route("/starred")
def starred():
    fl = get_feedly_client()
    return jsonify(res=fl.get_feed_content(fl.token, "user/" + session['id'] + "/tag/global.saved", request.args.to_dict()))

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
    return jsonify(res=fl.save_for_later(fl.token, session['id'], [request.args['item']]).status_code)

@app.route("/unstar", methods=["POST"])
def unstar():
    fl = get_feedly_client()
    return jsonify(res=fl.save_for_later(fl.token, session['id'], [request.args['item']], False).status_code)

@app.route("/auth")
def auth():
    feedly = get_feedly_client()
    # Redirect the user to the feedly authorization URL to get user code
    code_url = feedly.get_code_url(FEEDLY_REDIRECT_URI)
    return redirect(code_url)

app.secret_key='yZ7BMXMOXj7YA3cR2yS0WrNPll8tilaEBiiRjreRKJB389orNqqwGE='

if __name__ == "__main__":
    app.run(debug=FEEDLY_SANDBOX, port=8080)

