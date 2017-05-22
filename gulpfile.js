var gulp = require('gulp');
var gutil = require('gulp-util');
var browserify = require('gulp-browserify');
var babel = require('gulp-babel');
var notify = require('gulp-notify');
var uglify = require('gulp-uglify');
var replace = require('gulp-replace-task');
var rename = require('gulp-rename');
var insert = require('gulp-insert');
var eslint = require('gulp-eslint');
var jasmine = require('gulp-jasmine');
var del = require('del');
var VERSION = require('./package.json').version;


var tasks = [
  'jslint',
  'browserify',
  'dist'
];

gulp.task('build', tasks);

gulp.task(
  'watch',
  tasks,
  watchFiles
);

// will do an initial build, then build on any changes to src
function watchFiles() {
  gulp.watch('./src/**', ['jslint', 'browserify']);
}

// delete the contents of build folder
gulp.task('cleanbuild', function() {
  return del([
    './dist/**',
    './sdk/**',
    './docs/**',
    ], {'force': true});
});

// browserify src/js to dist/browser/js
gulp.task('browserify', ['cleanbuild'], function() {
  var buildVars = getBuildVars();
  var replacePatterns = [
    {
      'match': 'buildTimestamp',
      'replacement': new Date().getTime()
    },
    {
      'match': 'stage',
      'replacement': buildVars.stage
    },
    {
      'match': 'VERSION',
      'replacement': VERSION
    }
  ];

  return gulp.src('./src/index.js')
    .pipe(browserify({
      'insertGlobals': true,
      'debug': false,
      'transform': ['babelify']
    }).on('error', notify.onError(function(error) {
      var message = 'Browserify error: ' + error.message;
      if ( buildVars.browserifyFailOnError === true ) {
        console.log(error);
        process.exit(1);
      }
      return message;
    })))
    .pipe(replace({
      patterns: replacePatterns
    }))
    .pipe(rename(function (path) {
      path.basename = 'clarifai-' + VERSION;
    }))
    .pipe(insert.prepend(BROWSER_HEADER))
    .pipe(gulp.dest('./sdk'))
    .pipe(rename(function (path) {
      path.basename = 'clarifai-latest';
    }))
    .pipe(gulp.dest('./sdk'))
    .pipe(uglify())
    .pipe(rename(function (path) {
      path.basename = 'clarifai-' + VERSION + '.min';
    }))
    .pipe(gulp.dest('./sdk'))
    .pipe(rename(function (path) {
      path.basename = 'clarifai-latest.min';
    }))
    .pipe(gulp.dest('./sdk'));
});

gulp.task('dist', ['browserify'], function() {
  return gulp.src('./src/**/*.js')
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(gulp.dest('./dist'));
});

var buildVars = {};

buildVars.dev = {
  'stage': 'dev',
  'browserifyDebug': true,
  'uglify': false,
  'lintFailOnError': false,
  'browserifyFailOnError': false
};

buildVars.test = {
  'stage': 'test',
  'browserifyDebug': true,
  'uglify': false,
  'lintFailOnError': true,
  'browserifyFailOnError': true
};

buildVars.staging = {
  'stage': 'staging',
  'browserifyDebug': false,
  'uglify': true,
  'lintFailOnError': true,
  'browserifyFailOnError': true
};

buildVars.prod = {
  'stage': 'prod',
  'browserifyDebug': false,
  'uglify': true,
  'lintFailOnError': true,
  'buildMock': false,
  'browserifyFailOnError': true
};

function getBuildVars() {
  var stageString = process.env.CLARIFAI_DEPLOY || gutil.env.stage || 'dev';
  return buildVars[stageString];
}

var BROWSER_HEADER = (
  '/**\n' +
  ' * Clarifai JavaScript SDK v' + VERSION + '\n' +
  ' *\n' +
  ' * Last updated: ' + new Date() + '\n' +
  ' *\n' +
  ' * Visit https://developer.clarifai.com\n' +
  ' *\n' +
  ' * Copyright (c) 2016-present, Clarifai, Inc.\n' +
  ' * All rights reserved.\n' +
  ' * Licensed under the Apache License, Version 2.0.\n' +
  ' *\n' +
  ' * The source tree of this library can be found at\n' +
  ' *   https://github.com/Clarifai/clarifai-javascript\n' +
  ' */\n'
);

var lintOptions = {
  'env': [
    'browser',
    'node'
  ],
  'rules': {
    'spaced-comment': [2, "always"],
    'semi': [2, "always"],
    'curly': [2, "all"],
    'no-else-return': 2,
    'no-unreachable': 2,
    'no-return-assign': 2,
    'indent': [2, 2],
    'no-unused-vars': [2, {vars: "all", args: "none"}],
    'key-spacing': [2, {afterColon: true}],
    'quotes': [2, "single"],
    'camelcase': 2,
    'new-cap': 2,
    'no-const-assign': 2,
    'eqeqeq': 2,
    'no-multi-str': 2
  }
}

gulp.task('jslint', function () {
  var buildVars = getBuildVars();
  if ( buildVars.lintFailOnError === true ) {
    return failOnError();
  } else {
    return dontFailOnError();
  }
});

function dontFailOnError() {
  return gulp.src(['./src/**/*.js'])
    .pipe(eslint(lintOptions))
    .pipe(eslint.format())
    .pipe(eslint.failOnError().on('error', notify.onError('Error: <%= error.message %>')));
};

function failOnError() {
  return gulp.src(['./src/**/*.js'])
    .pipe(eslint(lintOptions))
    .pipe(eslint.format())
    .pipe(eslint.failOnError().on('error', function(e) {
      console.log('jslint error:', e);
      process.exit(1);
    }));
};

gulp.task('test', function() {
  return gulp.src('./spec/*.js')
    .pipe(jasmine({
      'includeStackTrace': true,
      'verbose': true,
      'timeout': 60000,
      'config': {
        'helpers': [
          './node_modules/babel-register/lib/node.js'
        ]
      }
    }).on('end', function() {
      process.exit();
    }).on('error', function() {
      process.exit(1);
    }));
});

