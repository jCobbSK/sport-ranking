var passport = require('passport'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    FacebookStrategy = require('passport-facebook'),
    db = require('../app/models');

module.exports = function(app) {
  var FACEBOOK_APP_ID = "1595898494015426";
  var FACEBOOK_APP_SECRET = "36a84365ec849abc1a2c29e65b56e2b3";

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
      clientID: FACEBOOK_APP_ID,
      clientSecret: FACEBOOK_APP_SECRET,
      callbackURL: "http://localhost:3500/auth/facebook/callback",
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
  app.use(session({secret: 'some secret'}));
  app.use(passport.initialize());
  app.use(passport.session());
}
