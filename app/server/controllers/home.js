var express = require('express'),
  router = express.Router(),
  db = require('../models'),
  q = require('q'),
  modelHelpers = require('../lib/modelHelpers'),
  authMiddleware = require('../middlewares/auth');

module.exports = function (app) {
  app.use('/', router);
};

router.use(authMiddleware);

router.get('/', function (req, _res, next) {

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
      actualRank: result.loggedUserRank
    });
  }).catch(function(err) {
    console.error(err);
    _res.sendStatus(401);
  });
});
