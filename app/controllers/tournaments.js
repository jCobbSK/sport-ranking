var express = require('express'),
    router = express.Router(),
    db = require('../models'),
    q = require('q'),
    authMiddleware = require('../middlewares/auth'),
    challongeIntegration = require('../lib/challonge-integration'),
    matchManagement = require('../lib/matchManagement'),
    md5 = require('md5');

module.exports = function(app) {
  app.use('/tournaments', router);
}

router.use(authMiddleware);

/**
 * Get all tournaments.
 */
router.get('/', function(req, res) {
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
      console.error(err);
      res.sendStatus(401);
    });
});

/**
 * Create tournament.
 */
router.post('/', function(req, res){
  var name = req.body['tournament-name'],
      type = req.body['tournament-type'],
      note = req.body['tournament-note'],
      startsAt = req.body['tournament-start'];

  var url = md5(name);
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
});

/**
 * Get specific tournament.
 */
router.get('/:id', function(req, res) {
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
          console.error(err);
          res.sendStatus(401);
        })
    })
    .catch(function(err){
      console.error(err);
      res.sendStatus(401);
    })
});

/**
 * Add/remove participant into specific tournament.
 */
router.get('/:id/join/:isJoining', function(req, res){
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

/**
 * Start/delete tournament.
 */
router.get('/:id/start/:isStarting', function(req, res){
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

/**
 * Submit match result.
 */
router.post('/match', function(req, res){
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
