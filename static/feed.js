var $current_article = $("#current_article");
var $next_article = $("#next_articles");
var $prev_article = $("#prev_articles");
var $count = $("#count");

var isStarred = location.search.indexOf("starred") >= 0;
$(isStarred ? "#starred_link" : "#all_link").hide();

var not_loaded_articles = [];
var MAX_RETRIES = 5;

function updateFeed(continuation, count, retries) {
    retries = retries || 0;
    count = count || 6;
    var args = {unreadOnly: true, count: count};

    if (continuation) {
        args.continuation = continuation;
    }

    var feed = isStarred ? "starred" : "feed";

    $.getJSON('/' + feed + '?' + $.param(args))
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

function saveForLaterToggle(id) {
    var $curr = $current_article.children();
    if($curr.data("starred")){
        $.post("/unstar?item=" + encodeURIComponent(currentItemId()), function(){});
    }else {
        $.post("/star?item=" + encodeURIComponent(currentItemId()), function(){});
    }
    $curr.data("starred", !$curr.data("starred"));
    $('#starred')[$curr.data('starred') ? 'show' : 'hide']();
}

function updateArticle(){
    var $current = $current_article.children();
    var $title = $current.find('h1.maintitle a');
    $('#starred')[$current.data('starred') ? 'show' : 'hide']();
    updateCount();
    window.scrollTo(0,0);
    spritzTitle();
    $('#share_link').attr('href', 'https://buffer.com/add/?' + $.param({
        url: $title.attr('href'),
        text: $title.text()
    }));
}

function nextArticle(){
    var next = $next_article.children().first();
    if(next.length){
        $current_article.children().appendTo($prev_article);
        next.appendTo($current_article);
        if(next.data('unread')){
            markRead(next.data('id'));
            next.data('unread', false);
        }
        setTimeout(preloadArticle, 3000);
        updateArticle();
    }else {
        spritzText("No more items");
    }
}

function prevArticle(){
    var prev = $prev_article.children().last();
    if(prev.length){
        $current_article.children().prependTo($next_article);
        prev.appendTo($current_article);
        updateArticle();
    }
}

function clickToLoadIframe(i, elm){
    var $this = $(this);
    $this.attr('data-src', $this.attr('src')).removeAttr('src').after(
        $('<button/>').click(function(){
            $this.attr('src', $this.attr('data-src'));
            $(this).remove();
        }).text('Load iframe')
    );
}

function getContentForArticle(article){
    var content = ((article.content && article.content.content) ||
        (article.summary && article.summary.content));

    if(article.enclosure){
        article.enclosure.forEach(function(media){
            content += "<p>";
            if(media.type == "image"){
                content += "<img src='" + media.href + "'></img>";
            } else {
                content += "Media enclosure: <pre>" + JSON.stringify(media) + "</pre>";
            }
            content += "</p>";
        });
    }
    return content || "No content";
}

function preloadArticle(){
    var article = not_loaded_articles.shift();
    if(!article) return;
    $("<div/>").append(
        $("<h1 class='maintitle'/>").append($("<a/>").attr('target', '_blank').attr('href', article.alternate[0].href).text(article.title))
    ).append(
        $("<div class='text-muted small'/>").text(article.origin.title + ' By ' + article.author)
    ).append(
        $("<div class='article_body'/>").html(getContentForArticle(article))
            .find("iframe").each(clickToLoadIframe).end()
            .find("a").attr("target", "_blank").end()
    ).data('unread', article.unread)
     .data('id', article.id)
     .data('starred', article.tags && article.tags.some(function(tag){ return tag.id.indexOf('global.saved') > 0;}))
     .appendTo($next_article);

}

function updateCount(){
    $count.text(not_loaded_articles.length + $next_article.children().length);
}
$e.subscribe('items-received', updateCount);

function refreshFeed(){
    $next_article.empty();
    $current_article.empty();
    $prev_article.empty();
    not_loaded_articles = [];
    spritzCancel();
    $("#loading").show();

    $e.once('items-received', function(){
        $("#loading").hide();
        preloadArticle();
        nextArticle();
        for (var i = 1; i < 6; i++) {
            setTimeout(preloadArticle, i*i*70);
        }
    });

    updateFeed();
}

$(document).keypress(function(e){
    switch(String.fromCharCode(e.which)){
        case 'j': return nextArticle();
        case 'k': return prevArticle();
        case 'q': return spritzCancel();
        case 's': return saveForLaterToggle();
        case 'w': return spritzTitle();
        case 'r': return refreshFeed();
        default: console.log(e.which);
    }
});

var hammer = new Hammer(document.body)
    .on('swipeleft', prevArticle)
    .on('swiperight', nextArticle);

var hammer2 = new Hammer($("#current_article")[0])
    .on('swipeleft', prevArticle)
    .on('swiperight', nextArticle);

refreshFeed();

