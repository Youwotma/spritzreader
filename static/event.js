
window.$e = {
    _topics: {},
    subscribe: function(topic, fn){
        if (!(topic in $e._topics)) {
            var flags = "stopOnFalse";
            if(/-loaded$/.test(topic)){
                flags += " once memory";
            }
            $e._topics[topic] = $.Callbacks(flags);
        }
        $e._topics[topic].add(fn);
    },
    unsubscribe: function(topic, callback){
        if(topic in $e._topics){
            $e._topics[topic].remove(callback);
        }
    },
    publish: function(topic){
        if(topic in $e._topics){
            var callbacks = $e._topics[topic];
            callbacks.fire.apply(callbacks, Array.prototype.slice.call(arguments, 1));
        }
    },
    once: function(topic, fn){
        $e.subscribe(topic, function once_inner(){
            $e.unsubscribe(topic, once_inner);
            return fn.apply(this, arguments);
        });
    }
};

$(function(){
    $(document.body).delegate("[data-event]", "click", function(){
        $e.publish(this.getAttribute("data-event"), this);
        return false;
    });
});

