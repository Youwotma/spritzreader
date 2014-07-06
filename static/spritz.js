var word_pre = document.getElementById("word_pre").firstChild;
var word_pivot = document.getElementById("word_pivot").firstChild;
var word_post = document.getElementById("word_post").firstChild;
var $sview = $("#spritz_view");

var wpm = 500;
var spritz_wordcount = 0;
var spritz_todo = [];
var spritz_tid = null;

var special_tags = {
    IMG: function(elm, ctx, out){
        out.push({
            image: loadImage(elm.getAttribute("src")),
            ctx: ctx.slice(0),
            text: elm.getAttribute("alt") || ""
        });
    }
};

function spritzHtml($elms, ctx, out) {
    ctx = ctx || [];
    out = out || [];
    $elms.each(function(i, e){
        if(e.nodeType == Element.ELEMENT_NODE){
            if((e.tagName in special_tags) && !special_tags[e.tagName](e, ctx, out)){
                return;
            }
            ctx.push(e.tagName);
            spritzHtml($(e).contents(), ctx, out);
            ctx.pop();
        } else if (e.nodeType == Element.TEXT_NODE) {
            out.push({
                text: e.nodeValue,
                ctx: ctx.slice(0)
            });
        }
    });
    return out;
}
spritzHtml($("<div>Hello World</div>"));

function splitText(text){
    return text.split(/\s+/).filter(function(w){
        return w.length > 0;
    });
}

function spritzText(text){
    spritzCancel();
    $sview.show();
    spritz_todo = splitText(text);
    spritz_wordcount = 0;
    spritzNext();
}

function spritzCancel(){
    $sview.hide();
    spritz_todo = [];
    spritz_firstword = true;
    if(spritz_tid) clearTimeout(spritz_tid);
    spritz_tid = null;
}

function spritzNext(){
    /*
    var item = items[0] && items[0].spritz;
    if(!item) return false;
    var element = item[0];
    if(!element){
        items.shift();
        return spritzNext();
    }
    if(element.text){
        element.words = element.text.split(/\s+/g);
        delete element.text;
    }
    var words = element.words;
    if(!words || words.length === 0) {
        item.shift();
        return spritzNext();
    }

    var word = words.shift();
    if(word.length === 0) return spritzNext();

    spritzWord(word);
    spritz_firstword = false;
    return true;
   */
    var word = spritz_todo.shift();
    if(!word) return spritzCancel();
    spritz_tid = setTimeout(spritzNext, spritzDuration(word));
    spritzWord(word);
}

function pivot(length){
    if(length <= 2){
        return 0;
    } else if (length <= 6) {
        return 1;
    } else if (length <= 10) {
        return 2;
    } else if (length <= 14) {
        return 3;
    } else {
        return 4;
    }
}

function spritzWord(word) {
    spritz_wordcount += 1;
    var pv = pivot(word.length);
    word_pre.nodeValue = word.slice(0, pv);
    word_pivot.nodeValue = word[pv];
    word_post.nodeValue = word.slice(pv + 1);
}

function spritzDuration(word){
    var d = 60*1000/wpm;
    d *= Math.max(1, 1.5 - spritz_wordcount/4); // First words slower
    d *= 1 + (word.length-4)*(0.2/7); // Longer words slower, sorter faster


    return d;
}

