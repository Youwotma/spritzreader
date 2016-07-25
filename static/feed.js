var $current_article = $("#current_article");
var $next_article = $("#next_articles");
var $prev_article = $("#prev_articles");
var $count = $("#count");

var isStarred = location.search.indexOf("starred") >= 0;
$(isStarred ? "#starred_link" : "#all_link").hide();

var not_loaded_articles = [];
var got_from_cache_ids = [];
var MAX_RETRIES = 5;

function hashArticle(article){
    var bytes = sha1(article.id)
        .substr(0, 12)
        .replace(/([0-9a-z]{2})/g, '0x$1 ').trim()
        .split(' ');
    return btoa(String.fromCharCode.apply(null, bytes));
}

function updateFeed(continuation, count, retries) {
    retries = retries || 0;
    count = count || 6;
    var args = {unreadOnly: true, count: count, have: got_from_cache_ids.join(',')};

    if (continuation) {
        args.continuation = continuation;
    }

    var feed = isStarred ? "starred" : "feed";

    $.getJSON('/' + feed + '?' + $.param(args))
    .done(function(data){
        var res = data.res;
        not_loaded_articles = not_loaded_articles.concat(res.items);
        $e.publish('items-received', res.items);
        $e.publish('items-received-net', res.items);
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

function doSyncAll(){
    var todos = [];

    function loadCachedArticles(){
        console.log('Loading cached articles...');
        getOfflineArticles().then(function(articles){
            if(articles.length) {
                console.log('Loaded ' + articles.length + ' articles from offline cache');
                not_loaded_articles = not_loaded_articles.concat(articles);
                got_from_cache_ids = articles.map(hashArticle);
                $e.publish('items-received', articles);
            }
            updateFeed();
        });
    }

    function todoThread(){
        if(todos.length) {
            var p = runTodo(todos.pop()).then(todoThread);
            if(!todos.length) {
                p.then(loadCachedArticles);
            }
        }
    }

    getTodos().then(function(_todos){
        todos = _todos;
        if(todos.length) {
            console.log('Doing ' + todos.length + ' todos');
            for (var i = 0, len = 3; i < len; i++) {
                todoThread();
            }
        } else {
            loadCachedArticles();
        }
    });
}

function isOnline(){
    return true;
}

function spritzTitle(){
    spritzText($current_article.find("h1:first").text());
}

function currentItemId() {
    return $current_article.children().data("id");
}

function markRead(id) {
    addTodo('mark_read', id).then(runTodo);
    removeOfflineArticle(id);
}

function hashId(){
    
}

function saveForLaterToggle(id) {
    var $curr = $current_article.children();

    var action = $curr.data('starred') ? 'unstar' : 'star';
    var oppositeAction = $curr.data('starred') ? 'star' : 'unstar';
    var itemid = currentItemId();
    removeTodo(oppositeAction, id);
    addTodo(action, itemid).then(runTodo);
    $curr.data("starred", !$curr.data("starred"));
    $('#starred')[$curr.data('starred') ? 'show' : 'hide']();
}

function runTodo(todo) {
    if(isOnline()) {
        $.post("/" + todo.type + "?item=" + encodeURIComponent(todo.article), function(){
            removeTodo(todo.id);
        });
    }
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

function nextArticle() {
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
        if($prev_article.children().length > 20) {
            var $oldArticle = $prev_article.children().first().find('img[src]').each(function(i, img){
                if(img.hasAttribute('data-orig-src')) {
                    URL.revokeObjectURL(img.getAttribute('src'));
                }
            });
            $oldArticle.remove();
        }
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
    content = content || "No content";
    content = content.replace(/(<img[^<>]*)\s+src\s*=/gi, '$1 data-orig-src=');
    return '<div class="article_body">' + content + '</div>';

}

function preloadImages(){
    function preload(article){
        article.imagesPreloaded = true;
        var $content = $(getContentForArticle(article));

        $content.find('img[data-orig-src]').each(function(_, img){
            getBlobFromUrl(img.getAttribute('data-orig-src'));
        });
    }

    for (var i = 0, len = not_loaded_articles.length; i < len; i++) {
        var article = not_loaded_articles[i];
        if(!article.imagesPreloaded) {
            return preload(article);
        }
    }
}

setTimeout(function(){
    setInterval(preloadImages, 5000);
}, 15000);

function getContentWithImages(article){
    article.imagesPreloaded = true;

    var content = getContentForArticle(article);
    var $content = $(content);
    var promises = [];
    var blobsByUrl = {};
    $content.find('img[data-orig-src]').each(function(_, img){
        var url = img.getAttribute('data-orig-src');
        var p = getBlobFromUrl(url).then(function(blob) {
            blobsByUrl[url] = blob;
        });
        promises.push(p);
    });

    return $.when(promises).then(function(){
        $content.find('img[data-orig-src]').each(function(i, img){
            var url = img.getAttribute('data-orig-src');
            if(url in blobsByUrl) {
                img.setAttribute('src', URL.createObjectURL(blobsByUrl[url]));
            }
        });

        return formatArticle(article, $content);
    });
}

function preloadArticle(){
    var article = not_loaded_articles.shift();
    if(!article){
        console.log('No article to preload');
        var d = $.Deferred(); d.resolve();
        return d.promise();
    }

    return getContentWithImages(article).then(function($article){
        $article.appendTo($next_article);
    });
}

function formatArticle(article, $content){
    var href = article.alternate && article.alternate[0].href;
    return $("<div/>").append(
        $("<h1 class='maintitle'/>").append($("<a/>").attr('target', '_blank').attr('href', href).text(article.title))
    ).append(
        $("<div class='text-muted small'/>").text(article.origin.title + ' By ' + article.author)
    ).append(
        $content.find("iframe").each(clickToLoadIframe).end()
                .find("a").attr("target", "_blank").end()
    ).data('unread', article.unread)
     .data('id', article.id)
     .data('starred', article.tags && article.tags.some(function(tag){ return tag.id.indexOf('global.saved') > 0;}));

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
        preloadArticle().then(function(){
            console.log('article preloaded');
            nextArticle();
            for (var i = 1; i < 10; i++) {
                setTimeout(preloadArticle, i*i*70);
            }
        });
    });

    doSyncAll();
}

$(document).keypress(function(e){
    switch(String.fromCharCode(e.which)){
        case 'j': return nextArticle();
        case 'k': return prevArticle();
        case 'q': return spritzCancel();
        case 's': return saveForLaterToggle();
        case 'w': return spritzTitle();
        case 'l': return spritzSelection();
        case 'r': return refreshFeed();
        default: console.log(e.which);
    }
});

refreshFeed();

