
/**
 * @constructor
 */
function $WatchProvider() {
  this.$get = [ '$parse', '$exceptionHandler', function ($parse, $exceptionHandler) {
    var manager = new $WatchProvider.WatchManager($parse, $exceptionHandler);

    var $watch = manager.watch.bind(manager);
    $watch.subscribe = manager.subscribe.bind(manager);
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

  this.depth_ = 0;
  this.stack_ = [];

  this.deliveries_ = 0;
  this.delivery_observer_ = new $WatchProvider.PathObserver(this, 'deliveries_', this.deliver_, this);
};


$WatchProvider.WatchManager.prototype.watch = function (obj, exp, listener, deep_equal) {
  if (!isString(exp)) {
    throw new Error('Watch expression can only by strings');
  }

  var desc = this.$parse.prepareObservable(exp);
  if (!desc.observable || desc.paths.length === 0) {
    this.queueListener_(obj, listener, desc.get(), undefined);
    this.reportDelivery_();
    return noop;
  }

  var watcher = this.addWatcher_(obj, desc, listener, deep_equal);

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


$WatchProvider.WatchManager.prototype.queueListener_ = function (obj, listener, value, last) {
  var queue_item = {
    obj: obj,
    watcher: null,
    listener: listener,
    value: value,
    last_value: last
  };

  this.queue_.push(queue_item);
};


$WatchProvider.WatchManager.prototype.queueWatcherListener_ = function (watcher, listener, value, last) {
  var index = this.watcher_queue_indexes_[watcher.$$id];
  delete this.queue_[index];

  var queue_item = {
    obj: watcher.$$obj,
    watcher: watcher,
    listener: listener,
    value: value,
    last_value: last
  };

  var queue_length = this.queue_.push(queue_item);
  this.watcher_queue_indexes_[watcher.$$id] = queue_length - 1;
};


$WatchProvider.WatchManager.prototype.addWatcher_ = function (obj, desc, listener, deep_equal) {
  var watcher = new $WatchProvider.Watcher(obj, desc.paths);
  var last_value = desc.get(obj);

  var self = this;
  watcher.onchange = function (changed_path) {
    // Note: Both Object.observer and Polymer/observe-js check for NaNs.

    var value = desc.get(obj);
    if (!deep_equal || !equals(value, last_value)) {
      self.queueWatcherListener_(watcher, listener, value, last_value);
      self.reportDelivery_();
    }

    last_value = value;
  };

  this.watchers_.push(watcher);
  this.queueWatcherListener_(watcher, listener, last_value, undefined);
  this.reportDelivery_();

  return watcher;
};


$WatchProvider.WatchManager.prototype.reportDelivery_ = function () {
  this.deliveries_ += 1;
};


$WatchProvider.WatchManager.prototype.deliver_ = function () {
  var queue = this.queue_;
  var watcher_indexes = this.watcher_queue_indexes_;

  var queue_length = queue.length;
  if (queue_length === 0) {
    this.depth_ = 0;
    return;
  }

  // TODO: extract the limit
  if (this.depth_ >= 100) {
    this.depth_ = 0;
    var listener = queue[0].listener;
    throw new Error(
      'Recursion limit of 100 listener iterations reached.\n' +
      'Last callbacks:\n  ' +
      map(this.stack_.slice(0, 10), function (fn) {
        return fn.name || fn.toString();
      }).join('\n  ')
    );
  }

  this.depth_ += 1;

  while (queue_length--) {
    var item = queue.shift();
    if (item) {
      if (item.watcher) {
        delete watcher_indexes[item.watcher.$$id];
      }

      try {
        this.stack_.unshift(item.listener);
        item.listener.call(null, item.value, item.last_value, item.obj);
      } catch (err) {
        this.$exceptionHandler(err);
      }
    }
  }

  forEach(this.subscribers_, function (subscriber) {
    try {
      this.stack_.unshift(subscriber);
      subscriber();
    } catch (err) {
      this.$exceptionHandler(err);
    }
  }, this);

  var self = this;
  this.depth_reset_timeout_ = setTimeout(function () {
    self.depth_reset_timeout_ = 0;
    self.depth_ = 0;
    self.stack_.length = 0;
  }, 0);
};


$WatchProvider.WatchManager.prototype.flush = function () {
  var delivers_before = this.deliveries_;

  this.watchers_.forEach(function (watcher) {
    watcher.flush();
  });

  this.delivery_observer_.deliver();
  if (this.deliveries_ !== delivers_before) {
    this.flush();
  }

  clearTimeout(this.depth_reset_timeout_);
  this.depth_ = 0;
  this.stack_.length = 0;
};


$WatchProvider.WatchManager.prototype.disposeAll = function () {
  this.watchers_.forEach(function (watcher) {
    watcher.dispose();
  });

  this.queue_ = [];
  this.watcher_queue_indexes_ = {};

  this.delivery_observer_.close();
  this.deliveries_ = 0;
  this.delivery_observer_ = new $WatchProvider.PathObserver(this, 'deliveries_', this.deliver_, this);

  clearTimeout(this.depth_reset_timeout_);
  this.depth_ = 0;
  this.stack_.length = 0;
};



/**
 * @constructor
 * @param {!Object} obj The object on which to observe paths.
 * @param {!Array.<string>} paths The paths to observe.
 */
$WatchProvider.Watcher = function (obj, paths) {
  var self = this;

  this.$$id = (++$WatchProvider.Watcher.prototype.$$id);
  this.$$obj = obj;

  /**
   * @type {!Array.<!PathObserver>}
   */
  this.observers = map(paths, function (path) {
    var handlePathChange = function (value) {
      self.handlePathChange_(path);
    };
    return new $WatchProvider.PathObserver(obj, path, handlePathChange);
  });
};


$WatchProvider.Watcher.prototype.$$id = 0;


$WatchProvider.Watcher.prototype.onchange = noop;


$WatchProvider.Watcher.prototype.handlePathChange_ = function (changed_path) {
  this.onchange(changed_path);
};


$WatchProvider.Watcher.prototype.flush = function () {
  forEach(this.observers, function (observer) {
    observer.deliver();
  });
};


$WatchProvider.Watcher.prototype.dispose = function () {
  forEach(this.observers, function (observer) {
    observer.close();
  });

  this.observers.length = 0;
};



/**
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
