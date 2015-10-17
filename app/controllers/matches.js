var express = require('express'),
    router = express.Router(),
    authMiddleware = require('../middlewares/auth'),
    q = require('q'),
    db = require('../models'),
    modelHelpers = require('../lib/modelHelpers'),
    validator = require('validator'),
    matchManagement = require('../lib/matchManagement'),
    Elo = require('arpad');
var elo = new Elo();

module.exports = function(app) {
  app.use('/matches', router);
}

router.use(authMiddleware);

/**
 * Get paginated matches.
 */
router.get('/', function(req, _res) {
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
});

/**
 * Create match.
 */
router.post('/', function(req, _res) {
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

/**
 * Request of delete last match of logged user. It is actually deleted after both participants
 * requested of deletion.
 */
router.get('/deleteLast', function(req, res) {
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
  }).catch(function(err){
    console.error(err);
    res.sendStatus(401);
  })
})
