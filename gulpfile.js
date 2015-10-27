var gulp = require('gulp');
var sass = require('gulp-sass');
var livereload = require('gulp-livereload');
var server = require('gulp-develop-server');
var webpack = require('webpack');
var gutil = require('gulp-util');

gulp.task('sass', function() {
  gulp.src('public/css/style.scss')
    .pipe(sass())
    .pipe(gulp.dest('public/css/', {overwrite: true}));
});

gulp.task('scripts', function(cb) {
  // run webpack
  webpack({
    // configuration
    entry: './app/client/index.js',
    output: {
      path: 'public/js/',
      filename: 'bundle.js'
    },
    module: {
      loaders: [
        { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader"}
      ]
    }
  }, function(err, stats) {
    if(err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString({
      // output options
    }));
    cb();
  });
});

gulp.task('watch', function() {
  var sass = gulp.watch('public/css/style.scss', ['sass', 'livereload']);
  var scripts = gulp.watch('app/client/**/*.js', ['scripts', 'livereload']);
  var server = gulp.watch('app/server/**/*.js', ['server:restart']);
});

gulp.task('server:start', function() {
  server.listen({path: './app.js'});
});

gulp.task('server:restart', function() {
  server.restart();
});

gulp.task('livereload', function() {
  livereload();
});

gulp.task('deploy', function() {

});

gulp.task('default', ['sass', 'scripts', 'watch', 'server:start']);
