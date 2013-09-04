
describe('$watch', function () {

  it('should watch scope keys', inject(function ($rootScope, $watch) {
    var watch_value;

    $rootScope.a = 3;
    $watch($rootScope, 'a', function (a, old_a) {
      watch_value = a;
    });

    $rootScope.a = 5;

    $watch.flush();
    expect(watch_value).toBe(5);
  }));
  

  it('should watch simple paths', inject(function ($rootScope, $watch) {
    var watch_value;

    $rootScope.a = { b: { c: 3 }};
    $watch($rootScope, 'a.b.c', function (a, old_a) {
      watch_value = a;
    });

    $rootScope.a.b.c = 5;

    $watch.flush();
    expect(watch_value).toBe(5);
  }));
});
