var $current_article = $("#current_article");
var $next_article = $("#next_articles");
var $prev_article = $("#prev_articles");

var not_loaded_articles = [];
var MAX_RETRIES = 5;

function updateFeed(continuation, count, retries) {
    retries = retries || 0;
    count = count || 6;
    var args = {unreadOnly: true, count: count};

    if (continuation) {
        args.continuation = continuation;
    }

    $.getJSON("/feed?" + $.param(args))
    .done(function(data){
        var res = data.res;
        not_loaded_articles = not_loaded_articles.concat(res.items);
        $e.publish('items-received', res.items);
        if(res.continuation){
            updateFeed(res.continuation, count*2, 0);
        }
    })
    .fail(function(err){
        if(retries > MAX_RETRIES){
            return alert("Could not update feed, network error? " + err);
        }
        setTimeout(
            updateFeed.bind(null, continuation, count, retries+1),
            Math.pow(6, retries)
        );
    });
}

function spritzTitle(){
    spritzText($current_article.find("h1:first").text());
}

function currentItemId() {
    return $current_article.children().data("id");
}

function markRead(id) {
    $.post("/mark_read?item=" + encodeURIComponent(id), function(){});
}

function saveForLater(id) {
    $.post("/star?item=" + encodeURIComponent(currentItemId()), function(){});
}


function nextArticle(){
    var next = $next_article.children().first();
    if(next.length){
        $current_article.children().appendTo($prev_article);
        next.appendTo($current_article);
        window.scrollTo(0,0);
        spritzTitle();
        if(next.data('unread')){
            markRead(next.data('id'));
            next.data('unread', false);
        }
        setTimeout(preloadArticle, 2000);
    }else {
        spritzText("No more items");
    }
}

function prevArticle(){
    var prev = $prev_article.children().last();
    if(prev.length){
        $current_article.children().prependTo($next_article);
        prev.appendTo($current_article);
        spritzTitle();
    }
}

function preloadArticle(){
    var article = not_loaded_articles.shift();
    if(!article) return;
    $("<div/>").append(
        $("<h1 class='maintitle'/>").append($("<a/>").attr('target', '_blank').attr('href', article.alternate[0].href).text(article.title))
    ).append(
        $("<div class='text-muted small'/>").text(article.origin.title + ' By ' + article.author)
    ).append(
        $("<div class='article_body'/>").html(article.content?article.content.content:article.summary.content)
            .find("a").attr("target", "_blank").end()
    ).data('unread', article.unread).data('id', article.id).appendTo($next_article);
}

$e.once('items-received', function(){
    $("#loading").hide();
    preloadArticle();
    nextArticle();
    for (var i = 1; i < 6; i++) {
        setTimeout(preloadArticle, i*i*70);
    }
});

$(document).keypress(function(e){
    switch(String.fromCharCode(e.which)){
        case 'j': return nextArticle();
        case 'k': return prevArticle();
        case 'q': return spritzCancel();
        case 's': return saveForLater();
        case 'w': return spritzTitle();
        default: console.log(e.which);
    }
});

updateFeed();

