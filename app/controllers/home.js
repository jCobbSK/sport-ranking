var express = require('express'),
  router = express.Router(),
  db = require('../models'),
  passport = require('passport');

module.exports = function (app) {
  app.use('/', router);
};

router.get('/login', function(req, res, next) {
  res.render('login',{layout: 'clean'});
});

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', {
    successRedirect: '/',
    failureRedirect: '/login'
  })
);

router.get('/auth/facebook', passport.authenticate('facebook'), function(req, res){});

router.get('/logout', function(req, res, next){
  req.logout();
  res.redirect('/');
});

router.get('/', isLoggedIn, function (req, res, next) {
  res.render('index', {
    title: 'Generator-Express MVC',
    users: [
      {id: 1, rank: 1, name: 'Jakub', points: '1600', self: true},
      {id: 2, rank: 2, name: 'Palo', points: '1605', self: false}
    ],

    matches: [
      {
        submitter: {name: 'Jakub', points: 32}, result: '12:10, 10:12, 10:10', other: {name: 'Palo', points: -32},
        createAt:'1/1/2015', winner: true, looser: false
      },
      {
        submitter: {name: 'Jakub', points: 32}, result: '12:10, 10:12, 10:10', other: {name: 'Palo', points: -32},
        createAt:'1/1/2015', winner: false, looser: true
      },
      {
        submitter: {name: 'Jakub', points: 32}, result: '12:10, 10:12, 10:10', other: {name: 'Palo', points: -32},
        createAt:'1/1/2015', winner: false, looser: false
      },
    ]
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();

  res.redirect('/login');
}
