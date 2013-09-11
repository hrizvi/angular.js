
/**
 * @constructor
 */
function $WatchProvider() {
  this.$get = [ '$parse', '$exceptionHandler', function ($parse, $exceptionHandler) {
    var manager = new $WatchProvider.WatchManager($parse, $exceptionHandler);

    var $watch = manager.watch.bind(manager);
    $watch.subscribe = manager.subscribe.bind(manager);
    $watch.evalAsync = manager.evalAsync.bind(manager);
    $watch.flush = manager.flush.bind(manager);
    $watch.disposeAll = manager.disposeAll.bind(manager);

    return $watch;
  }];
};


/**
 * @constructor
 */
$WatchProvider.WatchManager = function ($parse, $exceptionHandler) {
  this.$parse = $parse;
  this.$exceptionHandler = $exceptionHandler;

  this.watchers_ = [];
  this.subscribers_ = [];

  this.queue_ = [];
  this.watcher_queue_indexes_ = {};
  this.async_callback_queue_ = [];

  this.stack_reset_timeout_ = 0;
  this.stack_ = [];

  this.async_callbacks_ = 0;
  this.async_callback_observer_ = new $WatchProvider.PathObserver(
      this, 'async_callbacks_', this.scheduleDelivery_, this);

  this.deliveries_ = 0;
  this.delivery_observer_ = new $WatchProvider.PathObserver(
      this, 'deliveries_', this.deliver_, this);

  this.got_changes_ = false;
};


$WatchProvider.WatchManager.prototype.watch_ = function (obj, exp, listener, deep_equal) {
  if (!isString(exp)) {
    throw new Error('Watch expressions can only be strings');
  }

  var desc = this.$parse.prepareObservable(exp);
  if (!desc.observable || desc.paths.length === 0) {
    var value = desc.get();
    this.queueListener_(obj, exp, listener, value, value);
    return null;
  }

  var watcher = this.addWatcher_(obj, exp, desc, listener, deep_equal);
  return watcher;
};


$WatchProvider.WatchManager.prototype.watch = function (obj, exp, listener, deep_equal) {
  var watcher = this.watch_(obj, exp, listener, deep_equal);
  if (!watcher) {
    return noop;
  }

  this.watchers_.push(watcher);

  return function () {
    watcher.dispose();
  };
};


$WatchProvider.WatchManager.prototype.subscribe = function (subscriber) {
  this.subscribers_.push(subscriber);

  var self = this;
  return function () {
    self.subscribers_.splice(self.subscribers_.indexOf(subscriber), 1);
  };
};


$WatchProvider.WatchManager.prototype.evalAsync = function (callback, var_args) {
  var args = Array.prototype.slice.call(arguments, 1);

  this.queueAsyncCallback_(callback, args);
};


$WatchProvider.WatchManager.prototype.queueListener_ =
    function (obj, exp, listener, value, last) {
  var queue_item = {
    obj: obj,
    exp: exp,
    watcher: null,
    listener: listener,
    value: value,
    last_value: last
  };

  this.queue_.push(queue_item);
  this.scheduleDelivery_();
};


$WatchProvider.WatchManager.prototype.queueWatcherListener_ =
    function (watcher, listener, value, last) {
  var index = this.watcher_queue_indexes_[watcher.id];
  delete this.queue_[index];

  var queue_item = {
    obj: watcher.root,
    exp: watcher.exp,
    watcher: watcher,
    listener: listener,
    value: value,
    last_value: last
  };

  var queue_length = this.queue_.push(queue_item);
  this.watcher_queue_indexes_[watcher.id] = queue_length - 1;

  this.scheduleDelivery_();
};


$WatchProvider.WatchManager.prototype.queueAsyncCallback_ = function (callback, args) {
  var queue_item = {
    callback: callback,
    args: args
  };

  this.async_callback_queue_.push(queue_item);
  this.async_callbacks_ += 1;
};


$WatchProvider.WatchManager.prototype.addWatcher_ =
    function (obj, exp, desc, listener, deep_equal) {
  var watcher = new $WatchProvider.Watcher(obj, exp, desc.paths, deep_equal);
  var last_value = desc.get(obj);

  var self = this;
  watcher.onchange = function (changed_path) {
    // Note: Both Object.observer and Polymer/observe-js check for NaNs.

    var value = desc.get(obj);
    if (!deep_equal || !equals(value, last_value)) {
      self.got_changes_ = true;
      self.queueWatcherListener_(watcher, listener, value, last_value);
    }

    last_value = deep_equal ? copy(value) : value;
  };

  this.queueWatcherListener_(watcher, listener, last_value, last_value);

  if (deep_equal) {
    last_value = copy(last_value);
  }

  return watcher;
};


$WatchProvider.WatchManager.prototype.scheduleDelivery_ = function () {
  this.deliveries_ += 1;
};


$WatchProvider.WatchManager.prototype.deliver_ = function () {
  this.processQueues_();
  this.got_changes_ = false;

  this.checkStackSize_();
  if (this.stack_.length !== 0) {
    this.scheduleStackReset_();
  }
};


$WatchProvider.WatchManager.prototype.processQueues_ = function () {
  var async_callback_queue = this.async_callback_queue_.slice();
  this.async_callback_queue_.length = 0;

  var queue = this.queue_;
  var watcher_indexes = this.watcher_queue_indexes_;

  var async_callback_queue_length = async_callback_queue.length;
  var queue_length = queue.length;
  if (queue_length === 0 && async_callback_queue_length === 0) {
    this.stack_.length = 0;
    return;
  }

  var iteration_calls = [];
  this.stack_.push(iteration_calls);

  while (async_callback_queue_length--) {
    var item = async_callback_queue.shift();
    var callback = item.callback;
    try {
      callback.apply(null, item.args || []);
      iteration_calls.push('fn: ' + (callback.name || callback.toString()));
    } catch (err) {
      this.$exceptionHandler(err);
    }
  }

  if (queue_length === 0) {
    return;
  }

  while (queue_length--) {
    var item = queue.shift();
    if (item) {
      if (item.watcher) {
        delete watcher_indexes[item.watcher.id];
      }

      var listener = item.listener;
      try {
        item.listener.call(null, item.value, item.last_value, item.obj);

        var new_value_log, old_value_log;
        try {
          new_value_log = toJson(item.value);
        } catch (err) {
          // TypeError: Converting circular structure to JSON
          new_value_log = '*CIRCULAR*';
        }
        try {
          old_value_log = toJson(item.last_value);
        } catch (err) {
          // TypeError: Converting circular structure to JSON
          old_value_log = '*CIRCULAR*';
        }
        iteration_calls.push(
          item.exp + '; ' +
          'newVal: ' + new_value_log + '; ' +
          'oldVal: ' + old_value_log
        );
      } catch (err) {
        this.$exceptionHandler(err);
      }
    }
  }

  if (!this.got_changes_) {
    return;
  }

  forEach(this.subscribers_, function (subscriber) {
    try {
      subscriber();
      iteration_calls.push('fn: ' + (subscriber.name || subscriber.toString()));
    } catch (err) {
      this.$exceptionHandler(err);
    }
  }, this);
};


$WatchProvider.WatchManager.prototype.checkStackSize_ = function () {
  // TODO: extract the limit
  if (this.stack_.length >= 100) {
    var last_calls = this.stack_.slice(-5);
    this.stack_.length = 0;

    throw new Error(
      'Recursion limit of 100 delivery iterations reached.\n' +
      'Calls in the last 5 iterations: ' + toJson(last_calls)
    );
  }
};


$WatchProvider.WatchManager.prototype.scheduleStackReset_ = function () {
  var self = this;
  if (!this.stack_reset_timeout_) {
    this.stack_reset_timeout_ = setTimeout(function () {
      self.stack_reset_timeout_ = 0;
      self.stack_.length = 0;
    }, 0);
  }
};


$WatchProvider.WatchManager.prototype.flush = function () {
  if (this.stack_.length > 0) {
    throw new Error('$watch flush already in progress');
  }

  this.flush_();

  clearTimeout(this.stack_reset_timeout_);
  this.stack_reset_timeout_ = 0;
  this.stack_.length = 0;
};


$WatchProvider.WatchManager.prototype.flush_ = function () {
  var deliveries_before = this.deliveries_;
  var async_callbacks_before = this.async_callbacks_;

  this.watchers_.forEach(function (watcher) {
    watcher.flush();
  });

  this.async_callback_observer_.deliver();
  this.delivery_observer_.deliver();

  if (this.deliveries_ !== deliveries_before || this.async_callbacks_ !== async_callbacks_before) {
    this.flush_();
  }
};


$WatchProvider.WatchManager.prototype.disposeAll = function () {
  this.watchers_.forEach(function (watcher) {
    watcher.dispose();
  });
  this.subscribers_ = [];

  this.async_callback_queue_ = [];
  this.queue_ = [];
  this.watcher_queue_indexes_ = {};

  this.async_callback_observer_.close();
  this.async_callbacks_ = 0;
  this.async_callback_observer_ = new $WatchProvider.PathObserver(
      this, 'async_callbacks_', this.scheduleDelivery_, this);

  this.delivery_observer_.close();
  this.deliveries_ = 0;
  this.delivery_observer_ = new $WatchProvider.PathObserver(
      this, 'deliveries_', this.deliver_, this);

  clearTimeout(this.stack_reset_timeout_);
  this.stack_reset_timeout_ = 0;
  this.stack_.length = 0;

  this.got_changes_ = true;
};



/**
 * @constructor
 * @param {!Object} root The object on which to observe paths.
 * @param {string} exp The watched expression.
 * @param {!Array.<string>} paths The paths to observe.
 * @param {boolean=} deep Whether to watch all levels.
 */
$WatchProvider.Watcher = function (root, exp, paths, deep) {
  this.id = (++$WatchProvider.Watcher.prototype.id);
  this.root = root;
  this.exp = exp;
  this.paths_ = paths;
  this.deep_ = !!deep;

  /**
   * @type {!Object.<string, !PathObserver>}
   */
  this.root_observers = {};

  /**
   * @type {!Object.<string, {
   *   node_observer: !ObjectObserver,
   *   child_observers: Object
   * }>}
   */
  this.child_observers = {};

  this.init();
};


$WatchProvider.Watcher.prototype.init = function () {
  forEach(this.paths_, function (path) {
    var handleChange = function (new_value) {
      this.handlePathChange_(path);

      if (this.deep_) {
        this.closeObserverTree_(this.child_observers[path]);
        if (isObject(new_value)) {
          this.child_observers[path] = this.watchChildren_(new_value, handleChildChange);
        }
      }
    };

    var handleChildChange = function () {
      this.handlePathChange_(path);
    };

    var root_observer = new $WatchProvider.PathObserver(this.root, path, handleChange, this);
    this.root_observers[path] = root_observer;

    if (this.deep_) {
      var path_value = root_observer.value;
      if (isObject(path_value)) {
        this.child_observers[path] = this.watchChildren_(path_value, handleChildChange);
      }
    }
  }, this);
};


$WatchProvider.Watcher.prototype.id = 0;


$WatchProvider.Watcher.prototype.onchange = noop;


$WatchProvider.Watcher.prototype.handlePathChange_ = function (changed_path) {
  this.onchange(changed_path);
};


$WatchProvider.Watcher.prototype.watchChildren_ = function (root_value, onchange) {
  var handleChildChange = function (added, removed, changed) {
    forEach(added, function (child_value, key) {
      if (isObject(child_value)) {
        child_observers[key] = this.watchChildren_(child_value, onchange);
      }
    }, this);

    forEach(removed, function (child_value, key) {
      if (child_observers[key]) {
        this.closeObserverTree_(child_observers[key]);
        delete child_observers[key];
      }
    }, this);

    forEach(changed, function (child_value, key) {
      if (child_observers[key]) {
        this.closeObserverTree_(child_observers[key]);
      }
      if (isObject(child_value)) {
        child_observers[key] = this.watchChildren_(child_value, onchange);
      } else {
        delete child_observers[key];
      }
    }, this);

    onchange.call(this, root_value);
  };

  var node_observer = new $WatchProvider.ObjectObserver(root_value, handleChildChange, this);

  var child_observers = {};
  forEach(root_value, function (child_value, child_key) {
    if (isObject(child_value)) {
      child_observers[child_key] = this.watchChildren_(child_value, onchange);
    }
  }, this);

  return {
    node_observer: node_observer,
    child_observers: child_observers
  };
};


$WatchProvider.Watcher.prototype.closeObserverTree_ = function (tuple) {
  tuple.node_observer.close();
  forEach(tuple.child_observers, this.closeObserverTree_);
};


$WatchProvider.Watcher.prototype.flush = function () {
  forEach(this.root_observers, function (observer) {
    observer.deliver();
  });

  if (this.deep_) {
    var deliverChildChanges = function (child_observers) {
      forEach(child_observers, function (tuple, key) {
        tuple.node_observer.deliver();
        deliverChildChanges(tuple.child_observers);
      });
    };

    deliverChildChanges(this.child_observers);
  }
};


$WatchProvider.Watcher.prototype.dispose = function () {
  forEach(this.root_observers, function (observer) {
    observer.close();
  });

  this.root_observers.length = 0;
  this.child_observers = {};
};



/**
 * Polymer/observe-js ObjectObserver extension that does not catch exceptions
 * @constructor
 * @extends {PathObserver}
 */
$WatchProvider.ObjectObserver = function () {
  ObjectObserver.apply(this, Array.prototype.slice.call(arguments));
};

inherits($WatchProvider.ObjectObserver, ObjectObserver);


/**
 * @override
 */
$WatchProvider.ObjectObserver.prototype.invokeCallback = function (args) {
  this.callback.apply(this.target, args);
};



/**
 * Polymer/observe-js PathObserver extension that does not catch exceptions
 * @constructor
 * @extends {PathObserver}
 */
$WatchProvider.PathObserver = function () {
  PathObserver.apply(this, Array.prototype.slice.call(arguments));
};

inherits($WatchProvider.PathObserver, PathObserver);


/**
 * @override
 */
$WatchProvider.PathObserver.prototype.invokeCallback = function (args) {
  this.callback.apply(this.target, args);
};
