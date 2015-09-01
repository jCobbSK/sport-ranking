var express = require('express'),
  router = express.Router(),
  db = require('../models'),
  passport = require('passport'),
  q = require('q'),
  Elo = require('arpad'),
  matchManagement = require('../lib/matchManagement'),
  validator = require('validator'),
  modelHelpers = require('../lib/modelHelpers'),
  moment = require('moment'),
  challongeIntegration = require('../lib/challonge-integration')(),
  md5 = require('md5');

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

router.get('/users/:id', isLoggedIn, function(req, _res){
  //user's profile & all matches
  var usersId =req.params.id;
  q.all([
    db.Match.findAll({
      order: '"createdAt" DESC',
      include: [
        {model: db.User, as: 'winner'},
        {model: db.User, as: 'looser'},
        {model: db.User, as: 'submitter'}
      ],
      where: {
        $or: [
          {winner_id: usersId},
          {looser_id: usersId}
        ]
      }
    }),
    db.User.findAll({
      order: 'points DESC',
      include: [
        {model: db.Match, as: 'wins'},
        {model: db.Match, as: 'losses'}
      ]
    }),
    db.PointHistory.findAll({
      order: '"createdAt" ASC',
      where: {
        user_id: usersId
      }
    })
  ]).then(function(res){
    //calculate statistics
    var stats = matchManagement.calcStatistics(usersId, res[0]);
    var matches = modelHelpers.matchesTransform(usersId, res[0]);
    var users = modelHelpers.usersTransform(usersId, res[1]);
    var actualUser = users.users.filter(function(u){
      return u.id == usersId;
    })[0];
    actualUser.rank = users.loggedUserRank;

    _res.render('user-profile',{
      user: actualUser,
      stats: stats,
      matches: matches,
      users: users.users,
      pointHistory: JSON.stringify(res[2].map(function(obj){
        return [
          moment(obj.originCreatedAt).unix()*1000,
          obj.points
        ]
      }))
    });
  }).catch(function(err){
    res.sendStatus(401);
  });
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
    var result = modelHelpers.usersTransform(loggedUserId, res[0]);
    var loggedUserPoints = req.user.points;

    //calculate possible point addition if won
    result.users = result.users.map(function(user){
      user['possiblePointAddition'] = elo.newRatingIfWon(loggedUserPoints, user.points) - loggedUserPoints;
      return user;
    });

    var notRankedUsers = result.users.filter(function(user){
      return user.wins == 0 && user.losts == 0;
    });

    var users = result.users.filter(function(user){
      return user.wins != 0 || user.losts != 0;
    });

    _res.render('index', {
      tab: 'users',
      users: users,
      notRankedUsers: notRankedUsers,
      showResult: req.query.showResult == 'true',
      submitPoints: req.query.submitPoints,
      hasWon: req.query.hasWon == 'true',
      actualRank: result.loggedUserRank,
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
    var matches = modelHelpers.matchesTransform(loggedUserId, res[0].rows);

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
      }),
      db.PointHistory.create({
        user_id: winner.id,
        points: parseInt(winner.points) + parseInt(winDiff)
      }),
      db.PointHistory.create({
        user_id: looser.id,
        points: parseInt(looser.points) + parseInt(lostDiff)
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
  var loggedUserId = req.user.id;
  q.all([
    db.Tournament.findAll({
      order: '"createdAt" DESC',
      include: [
        {model: db.User, as: 'creator'},
        {model: db.User, as: 'winner'},
        {model: db.Participant, as: 'participants'}
      ],
      where: {
        cancelled: false
      }
    })
  ])
    .then(function(data){
      //TODO filter tournaments
      //  user's open ( creator == logged, no winner, no started)
      //  open (no winner, no cancelled, no started)
      //  in progress (no winner, no cancelled, started)
      //  winners (has winner)
      var tournaments = data[0] || [];
      var usersTournaments = tournaments.filter(function(tournament){
        return tournament.creator_id == loggedUserId && !tournament.winner_id;
      });

      var openTournaments = tournaments.filter(function(tournament){
        return !tournament.winner_id && !tournament.isStarted;
      }).map(function(tournament){
        tournament['joined'] = tournament.participants.filter(function(participant){
          return participant.id == loggedUserId;
        }).length == 1;
        return tournament;
      });

      var inProgress = tournaments.filter(function(tournament){
        return !tournament.winner_id && tournament.isStarted;
      });

      var allFinished = tournaments.filter(function(tournament) {
        return tournament.winner_id;
      });

      res.render('index', {
        tab: 'tournaments',
        usersTournaments: usersTournaments,
        openTournaments: openTournaments,
        inProgressTournaments: inProgress,
        finishedTournaments: allFinished
      })
    })
    .catch(function(err){
      debugger;
      res.sendStatus(401);
    });
});

router.get('/tournaments/:id', isLoggedIn, function(req, res) {
  res.render('tournament', {
    //TODO tournament page data
  });
});

router.get('/tournaments/:id/join/:isJoining', isLoggedIn, function(req, res){
  //TODO add/remove participants
  //TODO call challonge API accordingly
  res.redirect('/tournaments/' + req.params.id);
});

router.get('/tournaments/:id/start/:isStarting', isLoggedIn, function(req, res){
  //TODO need to check if logged user is creator of tournament
  //TODO delete tournament || call challonge API to start tournament
  res.redirect('/tournaments/'+req.params.id);
})

router.post('/add_tournament', isLoggedIn, function(req, res) {
  var name = req.body['tournament-name'],
    type = req.body['tournament-type'],
    note = req.body['tournament-note'];
    startsAt = req.body['tournament-start'];

  var url = md5(name);
  console.log(name, url, type, startsAt);
  challongeIntegration.createTournament(name, url, type, startsAt)
    .then(function(data){
      //data consists of challongeUrl, challongeId
      var challongeUrl = data.tournament.full_challonge_url,
        challongeId = data.tournament.id;
      q.all([
        db.Tournament.create({
          creator_id: req.user.id,
          name: name,
          type: type,
          note: note,
          challonge_url: challongeUrl,
          challonge_id: challongeId,
          startsAt: startsAt
        })
      ])
        .then(function(result){
          res.render('index', {
            tab: 'tournaments'
          });
        })
        .catch(function(err){
          res.sendStatus(401);
        })
    })
    .catch(function(err){
      res.sendStatus(401);
    })
})

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();

  res.redirect('/login');
}
