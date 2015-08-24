var express = require('express'),
  router = express.Router(),
  db = require('../models'),
  passport = require('passport'),
  q = require('q'),
  Elo = require('arpad'),
  matchManagement = require('../lib/matchManagement'),
  validator = require('validator');

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
    db.User.findAll({
      order: 'points DESC',
      include: [
        {model: db.Match, as: 'wins'},
        {model: db.Match, as: 'losses'}
      ]
    })
  ]).then(function(res) {

    //transform arrays
    var loggedUserId = req.user.id;
    var loggedUserRank = -1;
    var loggedUserPoints = req.user.points;

    //user -> add rank attr and self
    var rank = 0,
      points = 100000;
    var users = res[0].map(function(user) {
      if (user.points < points && (user.wins.length != 0|| user.losses.length != 0)) {
        rank++;
        points = user.points;
      }

      if (user.id == loggedUserId)
        loggedUserRank = rank;
      return {
        id: user.id,
        rank: rank,
        name: user.name,
        points: user.points,
        self: user.id == loggedUserId,
        wins: user.wins.length,
        losts: user.losses.length,
        probabilityOfWin: elo.expectedScore(loggedUserPoints, user.points).toFixed(2)
      }
    });

    var notRankedUsers = users.filter(function(user){
      return user.wins == 0 && user.losts == 0;
    });

    var users = users.filter(function(user){
      return user.wins != 0 || user.losts != 0;
    });

    _res.render('index', {
      title: 'Connect ping-pong league',
      tab: 'users',
      users: users,
      notRankedUsers: notRankedUsers,
      showResult: req.query.showResult == 'true',
      submitPoints: req.query.submitPoints,
      hasWon: req.query.hasWon == 'true',
      actualRank: loggedUserRank,
    });
  }).catch(function(err) {
    console.error(err);
    _res.sendStatus(401);
  });
});

router.get('/matches', isLoggedIn, function(req, _res, next){
  var actualPage = (parseInt(req.query.page) >= 0) ? parseInt(req.query.page) : 0;

  q.all([
    //matches
    db.Match.findAndCount({
      order: '"createdAt" DESC',
      include: [
        {model: db.User, as: 'winner'},
        {model: db.User, as: 'looser'}
      ],
      limit: 10,
      offset: 10 * actualPage
    }),
    db.User.findAll()
  ]).then(function(res) {

    var loggedUserId = req.user.id;
    //matches
    var matches = res[0].rows.map(function(match) {
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
        submitterIsWinner: match.submitter_id == match.winner_id,
        other: (match.submitter_id == match.winner_id) ? looser : winner,
        createdAt: match.createdAt,
        result: match.score,
        winner: match.winner_id == loggedUserId,
        looser: match.looser_id == loggedUserId
      }
    });

    _res.render('index', {
      title: 'Connect ping-pong league',
      tab: 'matches',
      matches: matches,
      matchPages: Math.ceil(res[0].count / 10),
      actualPage: actualPage,
      users: res[1]
    });
  }).catch(function(err) {
    console.error(err);
    _res.sendStatus(401);
  });
})

router.post('/add_match', isLoggedIn, function(req, _res, next) {
  var data = req.body;
  console.log('DATA ADD MATCH', data);

  //check params
  var firstKey = ['first', 'second', 'third'],
    secondKey = ['submitter', 'oponent'];
  var correct = true;
  for (var f in firstKey) {
    for (var s in secondKey) {
      var val = data[firstKey[f] + '-' + secondKey[s]];
      if (val != '' && !validator.isInt(val, {min: 0, max: 100})) {
        correct = false;
      }
    }
  }

  if (!validator.isInt(data['oponent']))
    correct = false;

  if (!correct) {
    //bad one or more params
    _res.redirect('/?error=' + encodeURIComponent('Bad params'));
    return;
  }

  //check params
  q.all([
    db.User.find(req.user.id),
    db.User.find(req.body.oponent)
  ]).then(function(res){
    if (!res[0] || !res[1]) {
      _res.redirect('/?error='+encodeURIComponent('Not logged in or bad oponent'));
      return;
    }

    var submitterScore = [data['first-submitter'], data['second-submitter'], data['third-submitter']].filter(function(i){
      return i != '';
    });
    var oponentScore = [data['first-oponent'], data['second-oponent'], data['third-oponent']].filter(function(i){
      return i != '';
    });


    try {
      //define winner/looser
      var submitterWon = matchManagement.matchResult(submitterScore, oponentScore);
    } catch(err) {
      //TIE error
      _res.redirect('/?error='+encodeURIComponent(err.toString()));
      return;
    }

    var scoreString = matchManagement.resultToString(submitterScore, oponentScore);
    var winner = (submitterWon) ? res[0] : res[1];
    var looser = (submitterWon) ? res[1] : res[0];
    var submitter = res[0];

    //calculate points
    var winnerPoints = elo.newRatingIfWon(winner.points, looser.points);
    var looserPoints = elo.newRatingIfLost(looser.points, winner.points);
    var winDiff = winnerPoints - winner.points;
    var lostDiff = looserPoints - looser.points;
    var submitterPoints = (submitterWon) ? winDiff : lostDiff;

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
      _res.redirect('/?showResult=true&submitPoints='+submitterPoints+'&hasWon='+submitterWon);
    }).catch(function(err){
      _res.redirect('/?error='+encodeURIComponent(err.toString()));
    })
  }).catch(function(err){
    _res.redirect('/?error='+encodeURIComponent(err.toString()));
  });
});

router.get('/tournaments', isLoggedIn, function(req, res) {
  res.render('index',{
    tab: 'tournaments'
  })
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();

  res.redirect('/login');
}
