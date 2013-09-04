
function $WatchProvider() {
  this.observers_ = [];
  this.queue_ = [];
  this.deliver_timeout_ = 0;

  var boundWatch = this.watch.bind(this);
  boundWatch.flush = this.flush.bind(this);

  this.$get = function () {
    return boundWatch;
  };
};


$WatchProvider.prototype.watch = function (obj, exp, listener) {
  var observer = new PathObserver(obj, exp, null, this);
  var last_value = observer.value;

  observer.callback = function (value) {
    this.queue_.push({
      listener: listener,
      value: value,
      last_value: last_value
    });

    last_value = value;
    this.setDeliverTimeout();
  };

  this.observers_.push(observer);

  return function () {
    observer.close();
  };
};


$WatchProvider.prototype.setDeliverTimeout = function () {
  if (!this.deliver_timeout_) {
    // call listeners at the beginning of the next available microtask
    this.deliver_timeout_ = setTimeout(this.deliver_.bind(this), 0);
  }
};


$WatchProvider.prototype.deliver_ = function () {
  this.deliver_timeout_ = 0;

  var queue = this.queue_;

  var item;
  while (item = queue.shift()) {
    item.listener.call(null, item.value, item.last_value);
  }
};


$WatchProvider.prototype.flush = function () {
  this.observers_.forEach(function (observer) {
    observer.deliver();
  });

  this.deliver_();
};
