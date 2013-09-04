
/**
 * @constructor
 * @ngInject
 */
function $WatchProvider() {
  this.watchers_ = [];
  this.queue_ = [];
  this.watcher_queue_indexes_ = {};
  this.deliver_timeout_ = 0;

  var boundWatch = this.watch.bind(this);
  var boundFlush = this.flush.bind(this);
  var boundDisposeAll = this.disposeAll.bind(this);

  this.$get = [ '$parse', function ($parse) {
    var callWatch = function (obj, exp, listener, deep_equal) {
      return boundWatch(obj, exp, listener, deep_equal, $parse);
    };

    callWatch.flush = boundFlush;
    callWatch.disposeAll = boundDisposeAll;

    return callWatch;
  }];
};


$WatchProvider.prototype.watch = function (obj, exp, listener, deep_equal, $parse) {
  if (!isString(exp)) {
    throw new Error('Watch expression can only by strings');
  }

  var desc = $parse.prepareObservable(exp);
  if (!desc.observable || desc.paths.length === 0) {
    self.queueListener_(listener, last_value, undefined);
    self.setDeliverTimeout();
    return noop;
  }

  var watcher = this.addWatcher_(obj, desc, listener, deep_equal);

  return function () {
    watcher.dispose();
  };
};


$WatchProvider.prototype.queueListener_ = function (listener, value, last) {
  var queue_item = {
    watcher: null,
    listener: listener,
    value: value,
    last_value: last
  };

  this.queue_.push(queue_item);
};


$WatchProvider.prototype.queueWatcherListener_ = function (watcher, listener, value, last) {
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


$WatchProvider.prototype.addWatcher_ = function (obj, desc, listener, deep_equal) {
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
  self.queueListener_(listener, last_value, undefined);
  self.setDeliverTimeout();

  return watcher;
};


$WatchProvider.prototype.setDeliverTimeout = function () {
  if (!this.deliver_timeout_) {
    // call listeners at the beginning of the next available microtask
    this.deliver_timeout_ = setTimeout(this.deliver_.bind(this), 0);
  }
};


$WatchProvider.prototype.deliver_ = function () {
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


$WatchProvider.prototype.flush = function () {
  this.watchers_.forEach(function (watcher) {
    watcher.flush();
  });

  this.deliver_();
};


$WatchProvider.prototype.disposeAll = function () {
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
