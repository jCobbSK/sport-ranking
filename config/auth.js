var passport = require('passport'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    FacebookStrategy = require('passport-facebook'),
    db = require('../app/models'),
    facebookSettings = require('./config.json')['facebookSettings'];

module.exports = function(app) {
  var actualFcbConf = (process.env.NODE_ENV == 'production') ? facebookSettings['production'] : facebookSettings['development'];
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
