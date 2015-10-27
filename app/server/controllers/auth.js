var express = require('express'),
    router = express.Router(),
    passport = require('passport');

module.exports = function(app) {
  app.use('/auth', router);
}

/**
 * Default login route.
 */
router.get('/login', function(req, res) {
  res.render('login', {layout: 'clean'});
});

/**
 * Route called after login to perform authentification proccess.
 */
router.get('/facebook/callback', passport.authenticate('facebook', {
  successRedirect: '/',
  failureRedirect: '/auth/login'
}));

/**
 * Logout route.
 */
router.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});
