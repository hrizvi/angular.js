
describe('$watch', function () {
  var obj = {};

  beforeEach(function () {
    module(function ($exceptionHandlerProvider) {
      $exceptionHandlerProvider.mode('log');
    });
  });


  afterEach(inject(function ($watch) {
    $watch.disposeAll();
    obj = {};
  }));


  it('should call listener after registration', inject(function ($watch) {
    var watch_value;

    obj.a = 3;
    $watch(obj, 'a', function (value, old_value) {
      watch_value = value;
    });

    $watch.flush();
    expect(watch_value).toBe(3);
  }));


  it('should watch scope keys', inject(function ($watch) {
    var watch_value;

    obj.a = 3;
    $watch(obj, 'a', function (value, old_value) {
      watch_value = value;
    });

    obj.a = 5;

    $watch.flush();
    expect(watch_value).toBe(5);
  }));


  it('should watch simple paths', inject(function ($watch) {
    var watch_value;

    obj.a = { b: { c: 3 }};
    $watch(obj, 'a.b.c', function (value, old_value) {
      watch_value = value;
    });

    obj.a.b.c = 5;

    $watch.flush();
    expect(watch_value).toBe(5);
  }));


  it('should watch multiple simple paths', inject(function ($watch) {
    var watch_value;

    obj.a = { b: { c: 3 }, d: 4};
    $watch(obj, 'a.b.c + a.d', function (value, old_value) {
      watch_value = value;
    });

    obj.a.b.c = 5;
    $watch.flush();
    expect(watch_value).toBe(9);

    obj.a.d = 2;
    $watch.flush();
    expect(watch_value).toBe(7);
  }));


  it('should not watch constants but call the listener on registration', inject(function ($watch) {
    var watch_value;

    $watch(obj, '5', function (value, old_value) {
      watch_value = value;
    });

    $watch.flush();
    expect(watch_value).toBe(5);
  }));


  it('should aggregate changes to multiple paths within one watcher', inject(function ($watch) {
    var count = 0;

    obj.a = { b: { c: 3 }, d: 4};
    $watch(obj, 'a.b.c + a.d', function (value, old_value) {
      count += 1;
    });

    $watch.flush();
    count = 0;

    obj.a.b.c = 5;
    obj.a.d = 2;
    $watch.flush();
    expect(count).toBe(1);
  }));


  it('should not consider NaNs different', inject(function ($watch) {
    var count = 0;

    obj.a = NaN;
    $watch(obj, 'a', function (value, old_value) {
      count += 1;
    });

    $watch.flush();
    count = 0;

    obj.a = NaN;

    $watch.flush();
    expect(count).toBe(0);
  }));


  it('should not consider changes to deeper levels changes', inject(function ($watch) {
    var count = 0;

    obj.a = { x: 2, y: { a: 3, b: 4 }};
    $watch(obj, 'a', function (value, old_value) {
      count += 1;
    });

    $watch.flush();
    count = 0;

    obj.a.x = 3;
    obj.a.y.a = 5;

    $watch.flush();
    expect(count).toBe(0);
  }));


  describe('exceptions', function () {
    it('should delegate exceptions from watcher listeners', inject(function ($watch, $exceptionHandler, $log) {
      obj.a = 3;

      $watch(obj, 'a', function () {
        throw new Error('abc');
      });

      $watch.flush();
      expect($exceptionHandler.errors[0].message).toEqual('abc');
      $log.assertEmpty();
    }));


    it('should delegate exceptions from subscribers', inject(function ($watch, $exceptionHandler, $log) {
      obj.a = 3;

      $watch(obj, 'a', noop);
      $watch.subscribe(function () {
        throw new Error('abc');
      });

      $watch.flush();
      expect($exceptionHandler.errors[0].message).toEqual('abc');
      $log.assertEmpty();
    }));
  });


  describe('recursion control', function () {
    it('should prevent infinite recursion', inject(
        function ($watch) {
      $watch(obj, 'a', noop);
      $watch.subscribe(function () { obj.a += 1; });

      obj.a = 0;

      try {
        $watch.flush();
        throw Error('Should have thrown exception');
      } catch (err) {
        expect(err.message).toNotEqual('Maximum call stack size exceeded');
        expect(err.message).toNotEqual('Should have thrown exception');
      }
    }));


    it('should reset recursion counter when idle', inject(function ($watch) {
      $watch(obj, 'a', noop);
      $watch.subscribe(function () {
        if (obj.a !== 50) {
          obj.a += 1;
        }
      });

      obj.a = 0;
      $watch.flush();
      expect(obj.a).toBe(50);

      obj.a += 1;
      try {
        $watch.flush();
        throw Error('Should have thrown exception');
      } catch (err) {
        expect(err.message).toNotEqual('Should have thrown exception');
        expect(obj.a).toBe(151);
      }
    }));


    it('should reset recursion counter when the recursion limit is reached', inject(
        function ($watch) {
      $watch(obj, 'a', noop);
      $watch.subscribe(function () { obj.a += 1; });

      obj.a = 0;

      try {
        $watch.flush();
        throw Error('Should have thrown exception');
      } catch (err) {
        expect(err.message).toNotEqual('Should have thrown exception');
        expect(obj.a).toBe(100);
      }

      obj.a = 0;

      try {
        $watch.flush();
        throw Error('Should have thrown exception');
      } catch (err) {
        expect(err.message).toNotEqual('Should have thrown exception');
        expect(obj.a).toBe(100);
      }
    }));


    it('should print names or bodies of the last 10 listeners/subscribers on limit', inject(
        function ($watch) {
      $watch(obj, 'a', noop);
      $watch(obj, 'b', noop);
      $watch.subscribe(function watcherA() { obj.b += 1; });
      $watch.subscribe(function () { obj.a += 1; });

      obj.a = 0;
      obj.b = 0;

      try {
        $watch.flush();
        throw Error('Should have thrown exception');
      } catch (err) {
        expect(err.message).toNotEqual('Should have thrown exception');
        expect(err.message.match(/fn: (watcherA|function.*?obj\.(a|b))/gm).length).toBe(10);
      }
    }));
  });


  describe('ordering', function () {
    it('should call watcher listeners in order of addition', inject(function ($watch) {
      var log = '';

      obj.a = 1;
      obj.b = 1;
      obj.c = 1;

      $watch(obj, 'a', function() { log += 'a'; });
      $watch(obj, 'b', function() { log += 'b'; });
      // constant expressions have slightly different handling,
      // let's ensure they are kept in the same list as others
      $watch(obj, '1', function() { log += '1'; });
      $watch(obj, 'c', function() { log += 'c'; });
      $watch(obj, '2', function() { log += '2'; });

      $watch.flush();
      expect(log).toEqual('ab1c2');

      obj.c = 2;
      obj.a = 2;
      obj.b = 2;

      log = '';
      $watch.flush();
      expect(log).toEqual('abc');
    }));


    it('should call subscribers in order of addition', inject(function ($watch) {
      var log = '';

      obj.a = 1;

      $watch(obj, 'a', noop);
      $watch.subscribe(function() { log += 'a'; });
      $watch.subscribe(function() { log += 'b'; });
      $watch.subscribe(function() { log += 'c'; });

      obj.a = 2;

      $watch.flush();
      expect(log).toEqual('abc');
    }));


    it('should call subscribers after watcher listeners', inject(function ($watch) {
      var log = '';

      obj.a = 1;

      $watch.subscribe(function() { log += 'c'; });
      $watch(obj, 'a', function () { log += 'a'; });
      $watch.subscribe(function() { log += 'd'; });
      $watch(obj, 'a', function () { log += 'b'; });
      $watch.subscribe(function() { log += 'e'; });

      obj.a = 2;

      $watch.flush();
      expect(log).toEqual('abcde');
    }));
  });


  describe('deep equality mode', function () {
    it('should not consider different objects with the same key/value pairs different', inject(
        function ($watch) {
      var count = 0;

      obj.a = { x: 2, y: { a: 3, b: 4 }};
      $watch(obj, 'a', function (value, old_value) {
        count += 1;
      }, true);

      $watch.flush();
      count = 0;

      obj.a = { x: 2, y: { a: 3, b: 4 }};

      $watch.flush();
      expect(count).toBe(0);
    }));


    it('should consider changes to deeper levels changes', inject(function ($watch) {
      var count = 0;

      obj.a = { x: 2, y: { a: 3, b: 4 }};
      $watch(obj, 'a', function (value, old_value) {
        expect(value).toBe(obj.a);
        count += 1;
      }, true);

      $watch.flush();
      count = 0;

      obj.a.x += 1;
      obj.a.y.a += 1;

      $watch.flush();
      expect(count).toBe(1);
    }));
  });


  describe('subscribe', function () {
    it('should allow subscribing to all changes to observed paths', inject(function ($watch) {
      var count = 0;

      obj.a = 3;
      $watch(obj, 'a', noop);
      $watch.subscribe(function () {
        count = 1;
      });

      $watch.flush();
      count = 0;

      obj.a = 4;

      $watch.flush();
      expect(count).toBe(1);
    }));


    it('should not call subscriber if no paths are being observed on flush', inject(
        function ($watch) {
      var count = 0;

      $watch.subscribe(function () {
        count = 1;
      });

      $watch.flush();
      count = 0;

      $watch.flush();
      expect(count).toBe(0);
    }));


    it('should aggregate changes to multiple paths into one subscriber call', inject(
        function ($watch) {
      var count = 0;

      obj.a = 3;
      obj.b = 4;
      $watch(obj, 'a', noop);
      $watch(obj, 'b', noop);
      $watch.subscribe(function () {
        count = 1;
      });

      $watch.flush();
      count = 0;

      obj.a = 4;
      obj.b = 5;

      $watch.flush();
      expect(count).toBe(1);
    }));
  });


  describe('disposal', function () {
    it('should allow watcher disposal via a returned function', inject(function ($watch) {
      var count = 0;

      obj.a = 3;
      var dispose = $watch(obj, 'a', function (value, old_value) {
        count += 1;
      });

      $watch.flush();
      count = 0;

      dispose();
      obj.a = 4;

      $watch.flush();
      expect(count).toBe(0);
    }));


    it('should return noop as the disposal function for watched constant expressions', inject(
        function ($watch) {
      var dispose = $watch(obj, '3', function () {});
      expect(dispose).toBe(noop);
    }));


    it('should allow subscriber disposal via a returned function', inject(function ($watch) {
      var count = 0;

      obj.a = 3;
      $watch(obj, 'a', noop);

      var dispose = $watch.subscribe(function () {
        count += 1;
      });

      $watch.flush();
      count = 0;

      dispose();
      obj.a = 4;

      $watch.flush();
      expect(count).toBe(0);
    }));
  });
});
