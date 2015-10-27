var express = require('express'),
    router = express.Router(),
    authMiddleware = require('../middlewares/auth'),
    q = require('q'),
    db = require('../models'),
    matchManagement = require('../lib/matchManagement'),
    modelHelpers = require('../lib/modelHelpers'),
    moment = require('moment');

module.exports = function(app) {
  app.use('/users', router);
}

router.use(authMiddleware);

router.get('/:id', function(req, _res){
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
    db.sequelize.query(
      'SELECT *, (SELECT COUNT(*) FROM "Matches" WHERE "winner_id" = "Users"."id") AS "wins", (SELECT COUNT(*) FROM "Matches" WHERE "looser_id" = "Users"."id") AS "losts" FROM "Users" ORDER BY "points" DESC;'
    ),
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
    var users = modelHelpers.usersTransform({id: usersId}, res[1][0]);
    if (users.loggedUserRank == -1) {
      var actualUser = users.notRankedUsers.find(function(u){return u.id == usersId});
      actualUser.rank = '';
    } else {
      var actualUser = users.rankedUsers.find(function(u){return u.id == usersId});
    }
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
    console.error(err);
    res.sendStatus(500);
  });
});
