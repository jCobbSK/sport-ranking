'use strict';

var request = require('request'),
  db = require('./app/models'),
  q = require('q'),
  modelHelpers = require('./app/lib/modelHelpers'),
    path = require('path'),
    rootPath = path.resolve(__dirname);

module.exports = function (grunt) {
  // show elapsed time at the end
  require('time-grunt')(grunt);
  // load all grunt tasks
  require('load-grunt-tasks')(grunt);

  var reloadPort = 35729, files;

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    develop: {
      server: {
        file: 'app.js'
      }
    },
    sass: {
      dist: {
        files: {
          'public/css/style.css': 'public/css/style.scss'
        }
      }
    },
    wiredep: {
      task: {
        src: [
          'app/views/**/*.handlebars'
        ],
        options: {
          ignorePath: '../../../public/'
        },
        fileTypes: {
          html: {
            replace: {
              js: '<script src="/{{filePath}}"></script>',
              css: '<link rel="stylesheet" href="/{{filePath}}">'
            }
          }
        }
      }
    },
    watch: {
      options: {
        nospawn: true,
        livereload: reloadPort
      },
      js: {
        files: [
          'app.js',
          'app/**/*.js',
          'config/*.js'
        ],
        tasks: ['develop', 'delayed-livereload']
      },
      css: {
        files: [
          'public/css/*.scss'
        ],
        tasks: ['sass'],
        options: {
          livereload: reloadPort
        }
      },
      views: {
        files: [
          'app/views/*.handlebars',
          'app/views/**/*.handlebars'
        ],
        options: { livereload: reloadPort }
      }
    },
    shell: {
      target: {
        command: 'NODE_ENV=production forever ' + rootPath + '/app.js restart'
      }
    }
  });

  grunt.registerTask('default', [
    'wiredep',
    'sass',
    'develop',
    'watch'
  ]);

  grunt.registerTask('bundle-scripts', [
    'wiredep',
    'sass'
  ]);

  grunt.registerTask('deploy', [
    'bundle-scripts',
    'shell'
  ]);

  grunt.config.requires('watch.js.files');
  files = grunt.config('watch.js.files');
  files = grunt.file.expand(files);

  grunt.registerTask('delayed-livereload', 'Live reload after the node server has restarted.', function () {
    var done = this.async();
    setTimeout(function () {
      request.get('http://localhost:' + reloadPort + '/changed?files=' + files.join(','),  function(err, res) {
          var reloaded = !err && res.statusCode === 200;
          if (reloaded)
            grunt.log.ok('Delayed live reload successful.');
          else
            grunt.log.error('Unable to make a delayed live reload.');
          done(reloaded);
        });
    }, 500);
  });

  grunt.registerTask('init-point-history', 'Initialize point history table', function(){
    var done = this.async();
    var users = {};
    db.Match.findAll({
      order: '"createdAt" ASC',
      include: [
        {model: db.User, as: 'winner'},
        {model: db.User, as: 'looser'}
      ]
    }).then(function(res){
      var createPromises = [];
      for (var i= 0, len=res.length;i<len;i++) {
        var match = res[i];
        if (!users[match.winner.id])
          users[match.winner.id] = 1600;
        if (!users[match.looser.id])
          users[match.looser.id] = 1600;

        users[match.winner.id] += match.winner_points;
        users[match.looser.id] += match.looser_points;
        createPromises.push(
          db.PointHistory.create({
            user_id: match.winner.id,
            points: users[match.winner.id],
            originCreatedAt: match.createdAt
          })
        );
        createPromises.push(
          db.PointHistory.create({
            user_id: match.looser.id,
            points: users[match.looser.id],
            originCreatedAt: match.createdAt
          })
        );
      }

      q.all(createPromises).then(function(){
        console.log('Created');
        done(err);
      }).catch(function(err){
        console.error(err);
        done(err);
      })
    }).catch(function(err){
      console.error(err);
      done(err);
    })
  });

  grunt.registerTask('remove-last-match', 'remove last match and update user points and history', function(){
    var done = this.async();
    q.all([
      modelHelpers.removeLastMatch()
    ]).then(function(){
      console.log('Deleted.');
      done();
    }).catch(function(err){
      console.error(err);
      done();
    })
  });


};
