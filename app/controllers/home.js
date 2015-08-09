var express = require('express'),
  router = express.Router(),
  db = require('../models'),
  passport = require('passport'),
  q = require('q'),
  Elo = require('arpad'),
  matchManagement = require('../lib/matchManagement');

var elo = new Elo();

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

router.get('/', isLoggedIn, function (req, _res, next) {

  q.all([
    //users
    db.User.findAll({order: 'points DESC'}),

    //matches
    db.Match.findAll({
      order: '"createdAt" DESC',
      include: [
        {model: db.User, as: 'winner'},
        {model: db.User, as: 'looser'}
      ]
    })

  ]).then(function(res) {

    console.log('DB res', res[0], res[1]);

    //transform arrays
    var loggedUserId = req.user.id;

    //user -> add rank attr and self
    var rank = 0,
      points = 100000;
    var users = res[0].map(function(user) {
      if (user.points < points) {
        rank++;
        points = user.points;
      }
      return {
        id: user.id,
        rank: rank,
        name: user.name,
        points: user.points,
        self: user.id == loggedUserId
      }
    });
    console.log('Users', users);

    //matches
    var matches = res[1].map(function(match) {
      var winner = {
        name: match.winner.name,
        points: match.winner_points
      };

      var looser = {
        name: match.looser.name,
        points: match.looser_points
      };

      return {
        submitter: (match.submitter_id == match.winner_id) ? winner : looser,
        other: (match.submitter_id == match.winner_id) ? looser : winner,
        createdAt: match.createdAt,
        result: match.score,
        winner: match.winner_id == loggedUserId,
        looser: match.looser_id == loggedUserId
      }
    });

    _res.render('index', {
      title: 'Connect ping-pong league',
      users: users,
      matches: matches
    });
  }).catch(function(err) {
    console.error(err);
    _res.sendStatus(401);
  });

  //res.render('index', {
  //  title: 'Connect ping-pong league',
  //  users: [
  //    {id: 1, rank: 1, name: 'Jakub', points: '1600', self: true},
  //    {id: 2, rank: 2, name: 'Palo', points: '1605', self: false}
  //  ],
  //
  //  matches: [
  //    {
  //      submitter: {name: 'Jakub', points: 32}, result: '12:10, 10:12, 10:10', other: {name: 'Palo', points: -32},
  //      createdAt:'1/1/2015', winner: true, looser: false
  //    },
  //    {
  //      submitter: {name: 'Jakub', points: 32}, result: '12:10, 10:12, 10:10', other: {name: 'Palo', points: -32},
  //      createdAt:'1/1/2015', winner: false, looser: true
  //    },
  //    {
  //      submitter: {name: 'Jakub', points: 32}, result: '12:10, 10:12, 10:10', other: {name: 'Palo', points: -32},
  //      createdAt:'1/1/2015', winner: false, looser: false
  //    },
  //  ]
  //});
});

router.post('/add_match', isLoggedIn, function(req, res, next) {
  var data = req.body;
  console.log('DATA ADD MATCH', data);

  //check params
  q.all([
    db.User.find(req.user.id),
    db.User.find(req.body.oponent)
  ]).then(function(res){
    if (!res[0] || !res[1]) {
      res.sendStatus(401);
    }

    var submitterScore = [data['first-submitter'], data['second-submitter'], data['third-submitter']].filter(function(i){
      return i != '';
    });
    var oponentScore = [data['first-oponent'], data['second-oponent'], data['third-oponent']].filter(function(i){
      return i != '';
    });


    //define winner/looser
    var submitterWon = matchManagement.matchResult(submitterScore, oponentScore);
    var scoreString = matchManagement.resultToString(submitterScore, oponentScore);
    var winner = (submitterWon) ? res[0] : res[1];
    var looser = (submitterWon) ? res[1] : res[0];
    var submitter = res[0];

    //calculate points
    var winnerPoints = elo.newRatingIfWon(winner.points, looser.points);
    var looserPoints = elo.newRatingIfLost(looser.points, winner.points);
    var winDiff = winnerPoints - winner.points;
    var lostDiff = looserPoints - looser.points;

    //save everything (update users, create match)
    q.all([
      winner.updateAttributes({
        points: winnerPoints
      }),
      looser.updateAttributes({
        points: looserPoints
      }),
      db.Match.create({
        submitter_id: submitter.id,
        winner_id: winner.id,
        looser_id: looser.id,
        score: scoreString,
        winner_points: winDiff,
        looser_points: lostDiff
      })
    ]).then(function(){
      //redirect with change data
      res.redirect('/');
    }).catch(function(){
      res.sendStatus(401);
    })
  }).catch(function(){
    res.sendStatus(401);
  });

  res.redirect('/');
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();

  res.redirect('/login');
}
