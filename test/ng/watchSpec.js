
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


  it('should not call subscribers after listener registration', inject(function ($watch) {
    var count = 0;

    obj.a = 3;
    $watch(obj, 'a', noop);
    $watch.subscribe(function () {
      count += 1;
    });

    $watch.flush();
    expect(count).toBe(0);
  }));


  it('should call listeners with the same "new value" and "old value" arguments on registration',
      inject(function ($watch) {
    var watch_value;
    var watch_old_value;
    var watch_ref;
    var watch_old_ref;

    obj.a = 3;
    obj.b = {};

    $watch(obj, 'a', function (value, old_value) {
      watch_value = value;
      watch_old_value = old_value;
    });
    $watch(obj, 'b', function (ref, old_ref) {
      watch_ref = ref;
      watch_old_ref = old_ref;
    });

    $watch.flush();
    expect(watch_value).toBe(3);
    expect(watch_old_value).toBe(3);
    expect(watch_ref).toBe(obj.b);
    expect(watch_old_ref).toBe(obj.b);
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


  describe('$evalAsync', function () {
    it('should call $evalAsync callback on flush', inject(function ($watch) {
      var count = 0;

      $watch.evalAsync(function () {
        count += 1;
      });

      $watch.flush();
      expect(count).toBe(1);
    }));


    it('should not call a single $evalAsync callback multiple times', inject(function ($watch) {
      var count = 0;

      $watch.evalAsync(function () {
        count += 1;
      });

      $watch.flush();
      $watch.flush();
      expect(count).toBe(1);
    }));


    it('should call $evalAsync callback with the provided arguments', inject(function ($watch) {
      var count = 0;

      var x = {};
      var y = 2;
      var z = null;

      $watch.evalAsync(function (a, b, c) {
        count += 1;
        expect(a).toBe(x);
        expect(b).toBe(y);
        expect(c).toBe(z);
      }, x, y, z);

      $watch.flush();
      expect(count).toBe(1);
    }));


    it('should loop on a recursive $evalAsync call', inject(function ($watch) {
      var count = 0;

      $watch.evalAsync(function () {
        count += 1;
        $watch.evalAsync(function () {
          count += 1;
        });
      });

      $watch.flush();
      expect(count).toBe(2);
    }));


    it('should loop on a $evalAsync call from a listener', inject(function ($watch) {
      var count = 0;

      obj.a = 3;

      $watch(obj, 'a', function (value, old_value) {
        count += 1;
        $watch.evalAsync(function () {
          count += 1;
        });
      });

      $watch.flush();
      expect(count).toBe(2);
    }));


    it('should loop on a $evalAsync call from a subscriber', inject(function ($watch) {
      var count = 0;

      obj.a = 3;

      $watch(obj, 'a', noop);
      $watch.subscribe(function () {
        count += 1;
        $watch.evalAsync(function () {
          count += 1;
        });
      });

      $watch.flush();
      count = 0;

      obj.a = 5;
      $watch.flush();
      expect(count).toBe(2);
    }));


    it('should trigger path observers', inject(function ($watch) {
      var count = 0;
      var watch_value;

      obj.a = 3;

      $watch(obj, 'a', function (value) {
        count += 1;
        watch_value = value;
      });

      $watch.flush();
      count = 0;

      $watch.evalAsync(function () {
        count += 1;
        obj.a = 5;
      });

      $watch.flush();
      expect(count).toBe(2);
      expect(watch_value).toBe(5);
    }));


    it('should not trigger subscriber calls if no observed value changes', inject(
        function ($watch) {
      var log = '';

      obj.a = 3;

      $watch(obj, 'a', noop);
      $watch.subscribe(function () { log += 'b'; });
      $watch.evalAsync(function () { log += 'a'; });

      $watch.flush();
      expect(log).toBe('a');
    }));
  });


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

      obj.a = 5;
      $watch.flush();
      expect($exceptionHandler.errors[0].message).toEqual('abc');
      $log.assertEmpty();
    }));


    it('should clear stack', function () {
      module(function ($exceptionHandlerProvider) {
        $exceptionHandlerProvider.mode('rethrow');
      });
      inject(function ($watch, $exceptionHandler, $log) {
        obj.a = 3;

        $watch(obj, 'a', function () {
          throw new Error('abc');
        });

        expect(function () {
          $watch.flush();
        }).toThrow('abc');

        $watch.flush();
      });
    });
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
      log = '';

      obj.c = 2;
      obj.a = 2;
      obj.b = 2;
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


    it('should call $evalAsync callbacks in order of addition', inject(function ($watch) {
      var log = '';

      $watch.evalAsync(function() { log += 'a'; });
      $watch.evalAsync(function() { log += 'b'; });
      $watch.evalAsync(function() { log += 'c'; });

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


    it('should call $evalAsync callbacks before $watch listeners/subscribers', inject(function ($watch) {
      var log = '';

      obj.b = 3;

      $watch(obj, 'b', function () { log += 'b'; });
      $watch.subscribe(function () { log += 'b'; });

      $watch.flush();
      log = '';

      obj.b = 5;
      $watch.evalAsync(function () { log += 'a'; });
      $watch.evalAsync(function () { log += 'a'; });

      $watch.flush();
      expect(log).toBe('aabb');
    }));


    it('should interlace $evalAsync callback and $watch listeners/subscribers calls', inject(
        function ($watch) {
      var log = '';

      obj.b = 3;

      $watch.evalAsync(function () {
        log += 'a';
        obj.b = 4;
        $watch.evalAsync(function () {
          log += 'b';
          $watch.evalAsync(function () {
            log += 'c';
          });
        });
      });
      $watch(obj, 'b', function () { log += '.'; });
      $watch.subscribe(function () { log += '/'; });

      $watch.flush();
      expect(log).toBe('a.b./c');
    }));


    it('should not interlace $evalAsync callbacks registered in one delivery iteration with', inject(
        function ($watch) {
      var log = '';

      obj.b = 3;
      $watch(obj, 'b', function () {
        log += 'b';
        $watch.evalAsync(function () {
          log += 'd';
        });
      });
      $watch.subscribe(function () {
        log += 'c';
        $watch.evalAsync(function () {
          log += 'd';
        });
      });

      $watch.flush();
      log = '';

      obj.b = 5;
      $watch.evalAsync(function () {
        log += 'a';
        $watch.evalAsync(function () {
          log += 'd';
        });
      });

      $watch.flush();
      expect(log).toBe('abcddd');
    }));
  });


  describe('deep equality mode', function () {
    it('should allow non-object initial value', inject(function ($watch) {
      var count = 0;

      obj.a = 2;

      $watch(obj, 'a', function (value, old_value) {
        count += 1;
      }, true);

      $watch.flush();
      expect(count).toBe(1);

      obj.a = {};
      $watch.flush();
      expect(count).toBe(2);
    }));


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


    it('should stop observing descendants when removed from the tree', inject(function ($watch) {
      var count = 0;

      var descendant = { a: 3, b: 4 };
      obj.a = { x: 2, y: descendant };
      $watch(obj, 'a', function (value, old_value) {
        count += 1;
      }, true);

      $watch.flush();
      count = 0;

      descendant.a += 1;
      $watch.flush();
      expect(count).toBe(1);

      obj.a.y = null;
      $watch.flush();
      expect(count).toBe(2);

      descendant.a += 1;
      $watch.flush();
      expect(count).toBe(2);

      var old = obj.a;
      obj.a = null;
      $watch.flush();
      expect(count).toBe(3);

      old.x += 1;
      $watch.flush();
      expect(count).toBe(3);
    }));


    it('should stop observing direct descendants when removed from the tree', inject(
        function ($watch) {
      var count = 0;

      var descendant = { a: 3, b: 4 };
      obj.a = descendant;

      $watch(obj, 'a', function (value, old_value) {
        count += 1;
      }, true);

      $watch.flush();
      count = 0;

      descendant.a += 1;
      $watch.flush();
      expect(count).toBe(1);

      obj.a = null;
      $watch.flush();
      expect(count).toBe(2);

      descendant.a += 1;
      $watch.flush();
      expect(count).toBe(2);
    }));


    it('should start observing descendants added to the tree', inject(function ($watch) {
      var count = 0;

      var descendant1 = { a: 3, b: 4, id: 1 };
      var descendant2 = { a: 3, b: 4, id: 2 };
      obj.a = { x: 2, y: null };
      $watch(obj, 'a', function (value, old_value) {
        count += 1;
      }, true);

      $watch.flush();
      count = 0;

      obj.a.y = descendant1;
      $watch.flush();
      expect(count).toBe(1);

      obj.a.z = descendant2;
      $watch.flush();
      expect(count).toBe(2);

      descendant1.a += 1;
      $watch.flush();
      expect(count).toBe(3);

      descendant2.a += 1;
      $watch.flush();
      expect(count).toBe(4);

      obj.a = { y: 5 };
      $watch.flush();
      expect(count).toBe(5);

      obj.a.y += 1;
      $watch.flush();
      expect(count).toBe(6);
    }));
  });


  describe('watchPaths', function () {
    it('should trigger on change to any path', inject(function ($watch) {
      var count = 0;

      var paths = [ 'a', 'b.c', 'x' ];
      $watch.watchPaths(obj, paths, function () {
        count += 1;
      });

      $watch.flush();
      count = 0;

      obj.a = 5;
      $watch.flush();
      expect(count).toBe(1);

      obj.b = { c: 6 };
      $watch.flush();
      expect(count).toBe(2);
    }));


    it('should aggregate changes to multiple paths', inject(function ($watch) {
      var count = 0;

      var paths = [ 'a', 'b.c', 'x' ];
      $watch.watchPaths(obj, paths, function () {
        count += 1;
      });

      $watch.flush();
      count = 0;

      obj.a = 5;
      obj.b = { c: 6 };
      $watch.flush();
      expect(count).toBe(1);
    }));
  });


  describe('watchCollection', function () {
    var obj;

    beforeEach(inject(function ($watch) {
      log = [];
      obj = {};

      deregister = $watch.watchCollection(obj, 'collection', function logger(collection) {
        log.push(toJson(collection));
      });
    }));


    it('should not trigger if nothing change', inject(function ($watch) {
      $watch.flush();
      expect(log).toEqual([undefined]);

      $watch.flush();
      expect(log).toEqual([undefined]);
    }));


    it('should allow deregistration', inject(function ($watch) {
      obj.collection = [];
      $watch.flush();

      expect(log).toEqual(['[]']);

      obj.collection.push('a');
      deregister();

      $watch.flush();
      expect(log).toEqual(['[]']);
    }));


    describe('constants', function () {
      it('should trigger on contant collection', inject(function ($watch) {
        var value;
        $watch.watchCollection(obj, '["a","b"]', function (collection) {
          value = collection;
        });

        $watch.flush();
        expect(value).toEqual([ 'a', 'b' ]);
      }));
    });


    describe('directly passed collections', function () {
      it('should trigger on directly passed collection', inject(function ($watch) {
        var value;
        var coll = [ 'a', 'b' ];

        $watch.watchCollection(coll, function (collection) {
          value = collection;
        });

        $watch.flush();
        expect(value).toBe(coll);
      }));


      it('should trigger when a directly passed collection changes', inject(function ($watch) {
        var count = 0;
        var value;
        var coll = [ 'a', 'b' ];

        $watch.watchCollection(coll, function (collection) {
          count += 1;
          value = collection;
        });

        $watch.flush();
        count = 0;
        value = null;

        coll.push('c');
        $watch.flush();
        expect(count).toBe(1);
        expect(value).toBe(coll);
        value = null;

        coll[1] = 'd';
        $watch.flush();
        expect(count).toBe(2);
        expect(value).toBe(coll);
      }));
    });


    describe('array', function() {
      it('should trigger when property changes into array', inject(function ($watch) {
        obj.collection = 'test';
        $watch.flush();
        expect(log).toEqual(['"test"']);

        obj.collection = [];
        $watch.flush();
        expect(log).toEqual(['"test"', '[]']);

        obj.collection = {};
        $watch.flush();
        expect(log).toEqual(['"test"', '[]', '{}']);

        obj.collection = [];
        $watch.flush();
        expect(log).toEqual(['"test"', '[]', '{}', '[]']);

        obj.collection = undefined;
        $watch.flush();
        expect(log).toEqual(['"test"', '[]', '{}', '[]', undefined]);
      }));


      it('should not trigger change when object in collection changes', inject(function ($watch) {
        obj.collection = [{}];
        $watch.flush();
        expect(log).toEqual(['[{}]']);

        obj.collection[0].name = 'foo';
        $watch.flush();
        expect(log).toEqual(['[{}]']);
      }));


      it('should watch array properties', inject(function ($watch) {
        obj.collection = [];
        $watch.flush();
        expect(log).toEqual(['[]']);

        obj.collection.push('a');
        $watch.flush();
        expect(log).toEqual(['[]', '["a"]']);

        obj.collection[0] = 'b';
        $watch.flush();
        expect(log).toEqual(['[]', '["a"]', '["b"]']);

        obj.collection.push([]);
        obj.collection.push({});
        log = [];
        $watch.flush();
        expect(log).toEqual(['["b",[],{}]']);

        var temp = obj.collection[1];
        obj.collection[1] = obj.collection[2];
        obj.collection[2] = temp;
        $watch.flush();
        expect(log).toEqual([ '["b",[],{}]', '["b",{},[]]' ]);

        obj.collection.shift()
        log = [];
        $watch.flush();
        expect(log).toEqual([ '[{},[]]' ]);
      }));

      it('should watch array-like objects like arrays', inject(function ($watch) {
        var arrayLikelog = [];
        var obj = {};

        $watch.watchCollection(obj, 'arrayLikeObject', function logger(obj) {
          forEach(obj, function (element) {
            arrayLikelog.push(element.name);
          })
        });

        document.body.innerHTML = "<p>" +
            "<a name='x'>a</a>" +
            "<a name='y'>b</a>" +
          "</p>";

        obj.arrayLikeObject = document.getElementsByTagName('a');
        $watch.flush();
        expect(arrayLikelog).toEqual(['x', 'y']);
      }));
    });


    describe('object', function() {
      it('should trigger when property changes into object', inject(function ($watch) {
        obj.collection = 'test';
        $watch.flush();
        expect(log).toEqual(['"test"']);

        obj.collection = {};
        $watch.flush();
        expect(log).toEqual(['"test"', '{}']);
      }));


      it('should not trigger change when object in collection changes', inject(function ($watch) {
        obj.collection = {name: {}};
        $watch.flush();
        expect(log).toEqual(['{"name":{}}']);

        obj.collection.name.bar = 'foo';
        $watch.flush();
        expect(log).toEqual(['{"name":{}}']);
      }));


      it('should watch object properties', inject(function ($watch) {
        obj.collection = {};
        $watch.flush();
        expect(log).toEqual(['{}']);

        obj.collection.a= 'A';
        $watch.flush();
        expect(log).toEqual(['{}', '{"a":"A"}']);

        obj.collection.a = 'B';
        $watch.flush();
        expect(log).toEqual(['{}', '{"a":"A"}', '{"a":"B"}']);

        obj.collection.b = [];
        obj.collection.c = {};
        log = [];
        $watch.flush();
        expect(log).toEqual(['{"a":"B","b":[],"c":{}}']);

        var temp = obj.collection.a;
        obj.collection.a = obj.collection.b;
        obj.collection.c = temp;
        $watch.flush();
        expect(log).toEqual([ '{"a":"B","b":[],"c":{}}', '{"a":[],"b":[],"c":"B"}' ]);

        delete obj.collection.a;
        log = [];
        $watch.flush();
        expect(log).toEqual([ '{"b":[],"c":"B"}' ]);
      }));
    });
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
