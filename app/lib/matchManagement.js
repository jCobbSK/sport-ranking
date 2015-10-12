var validator = require('validator'),
    Elo = require('arpad');

var elo = new Elo();

module.exports = {

  /**
   *
   * @method createMatch
   * @param {{id: int, points: int, matchScore: []}} firstUser
   * @param {{id: int, points: int, matchScore: int[]}} secondUser
   * @param {function(scoreFirst, scoreSecond)} scoreFormattingFunc
   * @returns {
   *  winnerId: int,
   *  formattedScore: string,
   *  winnerPoints: int,
   *  looserPoints: int
   * }
   * @throws Error
   */
  createMatch: function(firstUser, secondUser, scoreFormattingFunc) {
    var correctScores = this.validateScoreArrays(firstUser.matchScore, secondUser.matchScore);
    var winner = (this.matchResult(correctScores[0], correctScores[1])) ? firstUser : secondUser;
    var looser = (winner.id == firstUser.id) ? secondUser : firstUser;
    var context = this;

    if (!scoreFormattingFunc) {
      scoreFormattingFunc = context.resultToString;
    }

    return {
      winnerId: winner.id,
      formattedScore: scoreFormattingFunc(correctScores[0], correctScores[1]),
      winnerPoints: elo.newRatingIfWon(winner.points, looser.points),
      looserPoints: elo.newRatingIfLost(looser.points, winner.points)
    }
  },

  /**
   * Method for validating scores. It checks values and their bounds + logical mismatches.
   * Such as [11,null,2], when such error occures error is thrown. Also it trims trailing
   * empty values.
   * It returns valid array consists of 2 transformed and correct arrays of scores.
   *
   * @method validateScoreArrays
   * @param first
   * @param second
   * @returns [][]
   * @throws Error
   */
  validateScoreArrays: function(first, second) {
    var res = [[],[]];
    res[0] = first.map(function(f){
                if (validator.isInt(f, {min: 0, max: 200})) {
                  return parseInt(f);
                } else {
                  return null;
                }
              });
    res[1] = second.map(function(f){
                if (validator.isInt(f, {min: 0, max: 200})) {
                  return parseInt(f);
                } else {
                  return null;
                }
              });
    //remove trailing nulls
    for (var i=0; i < res[0].length; i++) {
      if ((res[0][i] == null && res[1][i]  != null) || (res[0][i] != null && res[1][i] == null))
        throw new Error('Bad score');
    }

    res[0] = res[0].filter(function(f){return f != null;});
    res[1] = res[1].filter(function(f){return f != null;});
    return res;
  },

  /**
   * Determine if firstUser won from arrays of set results.
   * @method matchResult
   * @param {int[]} firstUser
   * @param {int[]} secondUser
   * @returns {boolean}
   */
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
