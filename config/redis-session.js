var express = require('express'),
    redis = require('redis'),
    session = require('express-session'),
    redisStore = require('connect-redis')(session);

var client = redis.createClient();

module.exports = function(app) {
  app.use(session(
    {
      secret: 'some-ultra-secret-code',
      store: new redisStore({host: 'localhost', port: 6379, client: client}),
      saveUninitialized: false,
      resave: false
    }
  ));
}
