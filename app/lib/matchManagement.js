module.exports = {
  matchResult: function(firstUser, secondUser) {

    function didWin(first, second) {
      if (first == second)
        throw new Error('Tie!');

      return (first > second)?1:0;
    }

    var res = 0;
    for (var i=0, len=firstUser.length; i < len; i++) {
      if (!isNaN(parseInt(firstUser[i])) && !isNaN(parseInt(secondUser[i])))
        res += didWin(parseInt(firstUser[i]), parseInt(secondUser[i]));
    }

    if (res == firstUser.length / 2)
      throw new Error('Tie!');
    return res > (firstUser.length / 2);
  },

  resultToString: function(firstUser, secondUser) {
    var res = '';
    for (var i=0, len=firstUser.length; i < len; i++) {
      if (!isNaN(firstUser[i]) && !isNaN(secondUser[i]))
        res += firstUser[i]+':'+secondUser[i]+' ';
    }
    return res;
  },

  /**
   * Calculate basic user's statistics from his (sorted) matches.
   * @method calcStatistics
   * @param {int} userId
   * @param {models.Match[]} matches
   * @returns {
   *  winStreak: [int],
   *  looseStreak: [int],
   *  mostWinsAgainst: [string],
   *  mostLostsAgainst: [string],
   *  favouritePlayer: [string]
   * }
   */
  calcStatistics: function(userId, matches) {
    function StreakCalculator(userId) {
      var userId = userId;
      var bestSoFar = 0;
      var actualCount = 0;

      return {
        addToCount: function(id) {
          if (userId != id) {
            if (bestSoFar < actualCount) {
              bestSoFar = actualCount;
            }
            actualCount = 0;
          } else {
            actualCount++;
          }
        },
        getResult: function() {
          return (bestSoFar > actualCount) ? bestSoFar : actualCount;
        }
      }
    }

    function IndexCalculator() {
      var arr = [];

      return {
        addItem: function(itemId) {
          if (!arr[itemId]) {
            arr[itemId] = 1;
          } else {
            arr[itemId]++;
          }
        },
        getResult: function() {
          var max = 0,
            results = [];
          for (var key in arr) {
            if (arr[key] > max) {
              results = [];
              results.push(key);
              max = arr[key];
            } else if (arr[key] == max) {
              results.push(key);
            }
          }
          return results.sort().join(' , ');
        }
      }
    }

    var winStreakCounter = StreakCalculator(userId),
      looseStreakCounter = StreakCalculator(userId),
      mostLostsAgainst = IndexCalculator(),
      mostWinsAgainst = IndexCalculator(),
      favouritePlayer = IndexCalculator();

    for (var i= 0, len=matches.length; i<len; i++) {
      var match = matches[i];
      winStreakCounter.addToCount(match.winner_id);
      looseStreakCounter.addToCount(match.looser_id);
      if (match.winner_id == userId) {
        mostWinsAgainst.addItem(match.looser.name);
        favouritePlayer.addItem(match.looser.name);
      } else if(match.looser_id == userId) {
        mostLostsAgainst.addItem(match.winner.name);
        favouritePlayer.addItem(match.winner.name);
      }
    }

    return {
      winStreak: winStreakCounter.getResult(),
      looseStreak: looseStreakCounter.getResult(),
      mostLostsAgainst: mostLostsAgainst.getResult(),
      mostWinsAgainst: mostWinsAgainst.getResult(),
      favouritePlayer: favouritePlayer.getResult()
    }
  }
}
