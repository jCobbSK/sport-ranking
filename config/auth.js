var passport = require('passport'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    FacebookStrategy = require('passport-facebook'),
    db = require('../app/models');

module.exports = function(app) {
  var FACEBOOK_SETTINGS = {
    development: {
      FACEBOOK_APP_ID: 1611295705809038,
      FACEBOOK_APP_SECRET: 'dd65faa81506c9bed6c17af52a03c752',
      callback: 'http://localhost:3500/auth/facebook/callback'
    },
    production: {
      FACEBOOK_APP_ID: "1595898494015426",
      FACEBOOK_APP_SECRET: "36a84365ec849abc1a2c29e65b56e2b3",
      callback: 'http://www.jcobb.me/auth/facebook/callback'
    }
  };

  var actualFcbConf = (process.env.NODE_ENV == 'production') ? FACEBOOK_SETTINGS['production'] : FACEBOOK_SETTINGS['development'];
  passport.serializeUser(function(user, done) {
    console.log('serializing', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    db.User.find({where:{id:id}}).then(function(user){
      console.log('deserializing', user);
      done(null, user);
    });
  });

  passport.use(new FacebookStrategy({
      clientID: actualFcbConf.FACEBOOK_APP_ID,
      clientSecret: actualFcbConf.FACEBOOK_APP_SECRET,
      callbackURL: actualFcbConf.callback,
      profileFields: ['id', 'displayName']
    },
    function(accessToken, refreshToken, profile, done){
      console.log(profile);
      db.User.find({where: {facebook_token: profile.id}})
        .then(function(user){
          if (!user) {
            db.User.create({
              facebook_token: profile.id,
              name: profile.displayName
            }).then(function(user){
              return done(null, user);
            });
          } else {
            return done(null, user);
          }
        });
    }
  ));

  app.use(cookieParser());
  app.use(session({
    secret: 'some secret',
    resave: true,
    saveUninitialized: true
  }));
  app.use(passport.initialize());
  app.use(passport.session());
}
