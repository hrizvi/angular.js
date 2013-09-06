var angularFiles = require('./angularFiles');
var sharedConfig = require('./karma-shared.conf');

module.exports = function(config) {
  sharedConfig(config, {testName: 'AngularJS: jqLiteObserved', logFile: 'karma-jqliteObserved.log'});

  config.set({
    files: angularFiles.mergeFilesFor('karma'),
    exclude: angularFiles.mergeFilesFor('karmaExclude'),

    browsers: [ 'chrome_with_harmony', 'Chrome' ],

    customLaunchers: {
      chrome_with_harmony: {
        base: 'Chrome',
        flags: [
          '--js-flags=--harmony'
        ]
      }
    },

    junitReporter: {
      outputFile: 'test_out/jqlite.xml',
      suite: 'jqLite'
    }
  });
};
