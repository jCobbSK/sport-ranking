var db = require('../models'),
  q = require('q');

module.exports = {
  matchesTransform: function(loggedUserId, matches) {
    var res = matches.map(function(match) {
      var winner = {
        id: match.winner.id,
        name: match.winner.name,
        points: match.winner_points
      };

      var looser = {
        id: match.looser.id,
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

    return res;
  },

  usersTransform: function(loggedUserId, users) {
    var loggedUserRank = -1;

    //user -> add rank attr and self
    var rank = 0,
      points = 100000;
    var res = users.map(function(user) {
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
        photo: user.photo
      }
    });

    return {
      users: res,
      loggedUserRank: loggedUserRank
    };
  },

  /**
   * Removes last match, point histories and update actual user points.
   * @returns {Q.promise}
   */
  removeLastMatch: function() {

    var deffered = q.defer();
    //remove match, remove point histories of both players, update players points
    q.all([
      db.Match.findAll({
        order: '"createdAt" DESC',
        include: [
          {model: db.User, as: 'winner'},
          {model: db.User, as: 'looser'}
        ],
        limit: 1
      }),
      db.PointHistory.findAll({
        order: '"createdAt" DESC',
        limit: 2
      })
    ])
      .then(function(data){
        var promises = [];

        //update user points
        promises.push(
          data[0][0].winner.updateAttributes({
            points: data[0][0].winner.points - data[0][0].winner_points
          })
        );

        promises.push(
          data[0][0].looser.updateAttributes({
            points: data[0][0].looser.points - data[0][0].looser_points
          })
        );

        //remove pointhistories
        promises.push(
          data[1][0].destroy()
        );

        promises.push(
          data[1][1].destroy()
        );

        //remove match
        promises.push(
          data[0][0].destroy()
        );

        q.all(promises)
          .then(function(data){
            deffered.resolve(data);
          })
          .catch(function(err){
            deffered.reject(err);
          });
      })
      .catch(function(err){
        deffered.reject(err);
      })
    return deffered.promise;
  }
}
