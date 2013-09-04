
describe('$watch', function () {
  it('should call listener after registration', inject(function ($rootScope, $watch) {
    var watch_value;

    $rootScope.a = 3;
    $watch($rootScope, 'a', function (value, old_value) {
      watch_value = value;
    });

    $watch.flush();
    expect(watch_value).toBe(3);
  }));


  it('should watch scope keys', inject(function ($rootScope, $watch) {
    var watch_value;

    $rootScope.a = 3;
    $watch($rootScope, 'a', function (value, old_value) {
      watch_value = value;
    });

    $rootScope.a = 5;

    $watch.flush();
    expect(watch_value).toBe(5);
  }));


  it('should watch simple paths', inject(function ($rootScope, $watch) {
    var watch_value;

    $rootScope.a = { b: { c: 3 }};
    $watch($rootScope, 'a.b.c', function (value, old_value) {
      watch_value = value;
    });

    $rootScope.a.b.c = 5;

    $watch.flush();
    expect(watch_value).toBe(5);
  }));


  it('should watch multiple simple paths', inject(function ($rootScope, $watch) {
    var watch_value;

    $rootScope.a = { b: { c: 3 }, d: 4};
    $watch($rootScope, 'a.b.c + a.d', function (value, old_value) {
      watch_value = value;
    });

    $rootScope.a.b.c = 5;
    $watch.flush();
    expect(watch_value).toBe(9);

    $rootScope.a.d = 2;
    $watch.flush();
    expect(watch_value).toBe(7);
  }));


  it('should aggregate changes to multiple paths within one watcher', inject(
      function ($rootScope, $watch) {
    var count = 0;

    $rootScope.a = { b: { c: 3 }, d: 4};
    $watch($rootScope, 'a.b.c + a.d', function (value, old_value) {
      count += 1;
    });

    $watch.flush();
    count = 0;

    $rootScope.a.b.c = 5;
    $rootScope.a.d = 2;
    $watch.flush();
    expect(count).toBe(1);
  }));


  it('should not consider NaNs different', inject(function ($rootScope, $watch) {
    var count = 0;

    $rootScope.a = NaN;
    $watch($rootScope, 'a', function (value, old_value) {
      count += 1;
    });

    $watch.flush();
    count = 0;

    $rootScope.a = NaN;

    $watch.flush();
    expect(count).toBe(0);
  }));


  it('should not consider changes to deeper levels changes', inject(function ($rootScope, $watch) {
    var count = 0;

    $rootScope.a = { x: 2, y: { a: 3, b: 4 }};
    $watch($rootScope, 'a', function (value, old_value) {
      count += 1;
    }, true);

    $watch.flush();
    count = 0;

    $rootScope.a.x = 3;
    $rootScope.a.y.a = 5;

    $watch.flush();
    expect(count).toBe(0);
  }));


  describe('deep equality mode', function () {
    it('should not consider different objects with the same key/value pairs different', inject(
        function ($rootScope, $watch) {
      var count = 0;

      $rootScope.a = { x: 2, y: { a: 3, b: 4 }};
      $watch($rootScope, 'a', function (value, old_value) {
        count += 1;
      }, true);

      $watch.flush();
      count = 0;

      $rootScope.a = { x: 2, y: { a: 3, b: 4 }};

      $watch.flush();
      expect(count).toBe(0);
    }));
  });
});
