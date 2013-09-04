
/**
 * @constructor
 */
function $WatchProvider() {
  this.$get = [ '$parse', function ($parse) {
    var manager = new $WatchProvider.WatchManager($parse);

    var $watch = manager.watch.bind(manager);
    $watch.flush = manager.flush.bind(manager);
    $watch.disposeAll = manager.disposeAll.bind(manager);

    return $watch;
  }];
};


/**
 * @constructor
 */
$WatchProvider.WatchManager = function ($parse) {
  this.$parse = $parse;

  this.watchers_ = [];
  this.queue_ = [];
  this.watcher_queue_indexes_ = {};
  this.deliver_timeout_ = 0;
};


$WatchProvider.WatchManager.prototype.watch = function (obj, exp, listener, deep_equal, $parse) {
  if (!isString(exp)) {
    throw new Error('Watch expression can only by strings');
  }

  var desc = this.$parse.prepareObservable(exp);
  if (!desc.observable || desc.paths.length === 0) {
    this.queueListener_(listener, desc.get(), undefined);
    this.setDeliverTimeout();
    return noop;
  }

  var watcher = this.addWatcher_(obj, desc, listener, deep_equal);

  return function () {
    watcher.dispose();
  };
};


$WatchProvider.WatchManager.prototype.queueListener_ = function (listener, value, last) {
  var queue_item = {
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
      self.setDeliverTimeout();
    }

    last_value = value;
  };

  this.watchers_.push(watcher);
  this.queueListener_(listener, last_value, undefined);
  this.setDeliverTimeout();

  return watcher;
};


$WatchProvider.WatchManager.prototype.setDeliverTimeout = function () {
  if (!this.deliver_timeout_) {
    // call listeners at the beginning of the next available microtask
    this.deliver_timeout_ = setTimeout(this.deliver_.bind(this), 0);
  }
};


$WatchProvider.WatchManager.prototype.deliver_ = function () {
  clearTimeout(this.deliver_timeout_);
  this.deliver_timeout_ = 0;

  var queue = this.queue_;
  var watcher_indexes = this.watcher_queue_indexes_;

  var i = queue.length;
  while (i--) {
    var item = queue.shift();
    if (item) {
      if (item.watcher) {
        delete watcher_indexes[item.watcher.$$id];
      }
      item.listener.call(null, item.value, item.last_value);
    }
  }
};


$WatchProvider.WatchManager.prototype.flush = function () {
  this.watchers_.forEach(function (watcher) {
    watcher.flush();
  });

  this.deliver_();
};


$WatchProvider.WatchManager.prototype.disposeAll = function () {
  clearTimeout(this.deliver_timeout_);

  this.watchers_.forEach(function (watcher) {
    watcher.dispose();
  });

  this.queue_ = [];
  this.watcher_queue_indexes_ = {};
};



/**
 * @constructor
 * @param {!Object} obj The object on which to observe paths.
 * @param {!Array.<string>} paths The paths to observe.
 */
$WatchProvider.Watcher = function (obj, paths) {
  var self = this;

  this.$$id = (++$WatchProvider.Watcher.prototype.$$id);

  /**
   * @type {!Array.<!PathObserver>}
   */
  this.observers = map(paths, function (path) {
    var handlePathChange = function (value) {
      self.handlePathChange_(path);
    };
    return new PathObserver(obj, path, handlePathChange);
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
