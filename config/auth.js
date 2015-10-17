var passport = require('passport'),
    cookieParser = require('cookie-parser'),
    redisSession = require('./redis-session'),
    FacebookStrategy = require('passport-facebook'),
    db = require('../app/models'),
    facebookSettings = require('./config.json')['facebookSettings'];

module.exports = function(app) {
  var actualFcbConf = (process.env.NODE_ENV == 'production') ? facebookSettings['production'] : facebookSettings['development'];
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    db.User.find({where:{id:id}}).then(function(user){
      done(null, user);
    });
  });

  passport.use(new FacebookStrategy({
      clientID: actualFcbConf.FACEBOOK_APP_ID,
      clientSecret: actualFcbConf.FACEBOOK_APP_SECRET,
      callbackURL: actualFcbConf.callback,
      profileFields: ['id', 'displayName', 'picture.type(large)']
    },
    function(accessToken, refreshToken, profile, done){
      console.log(profile);
      db.User.find({where: {facebook_token: profile.id}})
        .then(function(user){
          if (!user) {
            db.User.create({
              facebook_token: profile.id,
              name: profile.displayName,
              photo: profile.photos[0].value
            }).then(function(user){
              return done(null, user);
            });
          } else {
            if (user.photo != profile.photos[0].value || user.name != profile.displayName) {
              user.updateAttributes({
                photo: profile.photos[0].value,
                name: profile.displayName
              }).then(function(user){
                return done(null, user);
              }).catch(function(err){
                return done(err);
              })
            } else {
              return done(null, user);
            }
          }
        });
    }
  ));

  app.use(cookieParser());
  redisSession(app);
  app.use(passport.initialize());
  app.use(passport.session());
}
