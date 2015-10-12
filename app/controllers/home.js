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
    actualUser.rank = (actualUser.wins > 0 || actualUser.losts > 0) ? users.loggedUserRank : '';

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
    db.sequelize.query(
      'SELECT *, (SELECT COUNT(*) FROM "Matches" WHERE "winner_id" = "Users"."id") AS "wins", (SELECT COUNT(*) FROM "Matches" WHERE "looser_id" = "Users"."id") AS "losts" FROM "Users" ORDER BY "points" DESC;'
    )
  ]).then(function(res) {
    var result = modelHelpers.usersTransform(req.user, res[0][0]);

    _res.render('index', {
      tab: 'users',
      users: result.rankedUsers,
      notRankedUsers: result.notRankedUsers,
      showResult: req.query.showResult == 'true',
      submitPoints: req.query.submitPoints,
      hasWon: req.query.hasWon == 'true',
      actualRank: result.loggedUserRank,
      error: req.query.error
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
    db.User.findById(req.user.id),
    db.User.findById(req.body.oponent)
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
          return participant.user_id == loggedUserId;
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
        finishedTournaments: allFinished,
        error: req.query.error
      })
    })
    .catch(function(err){
      res.sendStatus(401);
    });
});

router.get('/tournaments/:id', isLoggedIn, function(req, res) {
  var tournamentId = req.params.id;

  db.Tournament.findById(tournamentId, {
    include: [
      {model: db.User, as: 'creator'},
      {model: db.User, as: 'winner'}
    ]
  })
    .then(function(tournament){
      challongeIntegration.getMatchesForTournament(tournamentId, req.user)
        .then(function(matches){
          res.render('tournament', {
            tournament: tournament,
            matches: matches
          });
        })
        .catch(function(err){
          res.sendStatus(401);
        })
    })
    .catch(function(err){
      res.sendStatus(400);
    })
});

router.get('/tournaments/:id/join/:isJoining', isLoggedIn, function(req, res){
  var promise;
  if (req.params.isJoining == 'true') {
    promise = challongeIntegration.addParticipant(req.user, req.params.id);
  } else {
    promise = challongeIntegration.removeParticipant(req.user, req.params.id);
  }
  promise.then(function(){
    res.redirect('/tournaments');
  }).catch(function(err){
    if (err.challongeError)
      res.redirect('/tournaments/?error='+err.challongeError);
    else
      res.sendStatus(401);
  })
});

router.post('/tournaments/add_match', isLoggedIn, function(req, res){
  var tournamentId = req.body['tournamentId'],
      matchId = req.body['matchId'],
      player1 = req.body['player1id'],
      player2 = req.body['player2id'];

  var player1Score = [req.body['first-submitter'], req.body['second-submitter'], req.body['third-submitter']];
  var player2Score = [req.body['first-oponent'], req.body['second-oponent'], req.body['third-oponent']];

  try {
    var result = matchManagement.createMatch({
      id: player1,
      matchScore: player1Score,
      points: 0
    }, {
      id: player2,
      matchScore: player2Score,
      points: 0
    }, function(f, s) {
      var res = [];
      for (var i=0; i < f.length; i++) {
        res.push(f[i]+':'+s[i]);
      }
      return res.join(',');
    });

    challongeIntegration.submitMatchResult(tournamentId, matchId, result.winnerId, result.formattedScore)
      .then(function(){
        res.redirect('/tournaments');
      })
      .catch(function(err){
        console.error(err);
        res.sendStatus(401);
      })

  } catch(err) {
    console.error(err);
    res.sendStatus(401);
  }

});

router.get('/tournaments/:id/start/:isStarting', isLoggedIn, function(req, res){
  var tournamentId = req.params.id,
      isStarting = req.params.isStarting == 'true',
      promise;

  if (isStarting)
    promise = challongeIntegration.startTournament(req.user, tournamentId);
  else
    promise = challongeIntegration.deleteTournament(req.user, tournamentId);

  promise
    .then(function(){
      res.redirect('/tournaments')
    })
    .catch(function(err){
      if (err.challongeError)
        res.redirect('/tournaments/?error='+err.challongeError);
      else
        res.sendStatus(401);
    })
});

router.post('/add_tournament', isLoggedIn, function(req, res) {
  var name = req.body['tournament-name'],
    type = req.body['tournament-type'],
    note = req.body['tournament-note'];
    startsAt = req.body['tournament-start'];

  var url = md5(name);
  console.log(name, url, type, startsAt);
  challongeIntegration.createTournament(req.user, name, url, type, startsAt, note)
      .then(function(result){
        res.redirect('/tournaments');
      })
      .catch(function(err){
        console.error(err.challongeError);
        if (err.challongeError)
          res.redirect('/tournaments/?error='+err.challongeError);
        else
          res.sendStatus(401);
      })
})

router.get('/requestDeleteMatch', isLoggedIn, function(req, res){
  var loggedUserId = req.user.id;
  //fetch last match
  db.Match.findAll({
    order: '"createdAt" DESC',
    limit: 1
  }).then(function(data){
    var match = data[0];
    if (match.winner_id != loggedUserId && match.looser_id != loggedUserId) {
      //logged user cant request deletion
      res.sendStatus(401);
      return;
    }

    var delReqs = JSON.parse(match.deleteRequests || "[]");
    if (delReqs.indexOf(loggedUserId) == -1) {
      delReqs.push(loggedUserId);
    }

    if (delReqs.length == 2) {
      //both users requested of deletion -> delete
      q.all([
        modelHelpers.removeLastMatch()
      ])
        .then(function(){
          res.redirect('/matches');
        })
        .catch(function(){
          res.sendStatus(401);
        })
    } else {
      match.updateAttributes({
        deleteRequests: JSON.stringify(delReqs)
      }).then(function(){
        res.redirect('/matches');
      }).catch(function(){
        res.sendStatus(401);
      });
    }
  }).catch(function(){
    res.sendStatus(401);
  })
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();

  res.redirect('/login');
}
