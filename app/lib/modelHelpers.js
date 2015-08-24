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
  }
}
