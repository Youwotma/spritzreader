// IndexedDB
var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
    IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction,
    dbVersion = 1.0;
var URL = window.URL || window.webkitURL;

var cacheMap = {};

var cacheTodo = 0;
var cacheDone = 0;
var cacheThreads = 0;
var cacheQueue = [];

var server = db.open({
    server: 'feed',
    version: {version: 4, storage: 'persistent'},
    schema: {
        images: {
            key: {
                keyPath: 'url'
            },
            // Optionally add indexes
            indexes: {
                created: {},
            }
        },
        todo: {
            key: {keyPath: 'id', autoIncrement: true},
            indexes: {
                article: {}
            }
        },
        articles: {
            key: {keyPath: 'id'},
        }
    }
});

function takeFirst(x) {
    return x[0];
}

function getUrl(url) {
    var d = $.Deferred();
    var xhr = new XMLHttpRequest();

    xhr.open("GET", "/proxy?url=" + encodeURIComponent(url), true);
    xhr.responseType = "blob";

    xhr.addEventListener("load", function () {
        if (xhr.status === 200) {
            d.resolve(xhr.response);
        } else {
            d.reject(xhr.status);
        }
    }, false);

    xhr.send();
    return d.promise();
}

function saveBlob(blob, url) {
    return server.then(function(server){
        return server.images.add({
            url: url,
            created: +new Date(),
            blob: blob
        });
    }).then(takeFirst);
}

function addTodo(type, article){
    return server.then(function(server) {
        return server.todo.add({
            article: article,
            type: type,
            date: +new Date(),
        });
    }).then(takeFirst);
}


function addOfflineArticle(article) {
    return server.then(function(server) {
        return server.articles.update({
            article: article,
            date: +new Date(),
            id: article.id,
        });
    }).then(takeFirst);
}

function removeOfflineArticle(article) {
    return server.then(function(server) {
        return server.articles.remove(article);
    });
}

function getOfflineArticles(starred){
    return server.then(function(server) {
        return server.articles.query().all().map(function(a) {
            return a.article;
        }).execute().done(function(list){
            return list.filter(function(article){
                var isStarred = article.tags && article.tags.some(tag => tag.id.indexOf('global.saved') > 0);
                return isStarred == starred;
            });
        });
    });
}

function getTodos(){
    return server.then(function(server) {
        return server.todo.query().all().execute();
    });
}

function prune(){
}

function removeTodo(idOrType, article) {
    return server.then(function(server) {
        if(article) { // type + article
            return server.todo.query()
                .filter('article', article)
                .filter('type', idOrType)
                .execute()
                .then(function(results){
                    return $.when.apply($, results.map(function(result) {
                        return removeTodo(result.id);
                    }));
                });
        } else { // id
            return server.todo.remove(idOrType);
        }
    });
}

function getBlobFromUrl(url) {
    return server.then(function(server){
        return server.images.get(url);
    }).then(function(obj){
        if(!obj) {
            return getUrl(url).then(function(blob) {
                return saveBlob(blob, url);
            });
        }
        return obj;
    }).then(function(obj){
        return obj && obj.blob;
    });

}

$e.subscribe('items-received-net', function(articles){
    articles.forEach(function(article){
        addOfflineArticle(article);
    });
});

