Package.describe({
  name: 'jam:archive',
  version: '0.1.0',
  summary: 'An easy way to add an archive mechanism to your Meteor app',
  git: 'https://github.com/jamauro/archive',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('3.0.2');
  api.use('ecmascript');
  api.use('jam:mongo-transactions@1.2.0');
  api.use('zodern:types@1.0.13');
  api.mainModule('archive.js');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('jam:archive');
  api.mainModule('tests.js');
});
