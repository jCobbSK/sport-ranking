var assert = require("assert"),
  mm = require('../app/lib/matchManagement');

describe('Match Management', function() {

  describe('#validateScoreArrays', function() {

    it('should trim trailing empty elements', function() {
      var trim = [['11', '11', ''],[0, '0', '', '']];

      var res = mm.validateScoreArrays(trim[0], trim[1]);
      assert(res[0].toString() == [11, 11].toString());
      assert(res[1].toString() == [0, 0].toString());
    })

    it('should throw error when logic errors', function() {
      var incorrect = [[0, null, 1], [null, 1, 1]];

      assert.throws(
        function(){
          mm.validateScoreArrays(incorrect[0], incorrect[1]);
        },
        Error
      );
    })

    it('should return 2 correct arrays of integers if everything works', function() {
      var scores = [['11', '2', '14'], ['8', '11', '12']];
      var res = mm.validateScoreArrays(scores[0], scores[1]);
      assert(res[0].toString() == [11,2,14].toString());
      assert(res[1].toString() == [8,11,12].toString());
    })
  })

  describe('#matchResult()', function () {
    it('should return false when the submit loose 1:2', function () {
      assert.equal(false, mm.matchResult(['11','6','6'],['6','11','11']));
    });
    it('should return false when the submit loose 0:1', function () {
      assert.equal(false, mm.matchResult(['0','',''],['11','','']));
    });
    it('should return true when the submit win 2:0', function () {
      assert.equal(true, mm.matchResult(['11','11',''],['6','7','']));
    });
    it('should return true when the submit loose 2:1', function () {
      assert.equal(true, mm.matchResult([11,8,11],[6,11,6]));
    });
  })

  describe('#createMatch', function() {
    it('should correctly return id of winner and return correct default formatted score', function() {
      var createdInfo = mm.createMatch(
        {
          id: 1,
          points: 0,
          matchScore: ['11', '2', '11']
        },
        {
          id: 2,
          points: 0,
          matchScore: ['8', '11', '2']
        }
      );

      assert(createdInfo.winnerId == 1);
      assert(createdInfo.formattedScore == '11:8 2:11 11:2 ');
    })

    it('should correctly used formatted function', function() {
      var createdInfo = mm.createMatch(
        {
          id: 1,
          points: 0,
          matchScore: ['11', '2', '11']
        },
        {
          id: 2,
          points: 0,
          matchScore: ['8', '11', '2']
        },
        function (f, s) {
          var res = [];
          for (var i=0; i < f.length; i++) {
            res.push(f[i]+':'+s[i]);
          }
          return res.join(',');
        }
      );
      assert(createdInfo.formattedScore == '11:8,2:11,11:2');
    })
  })

  describe('#calcStatistics', function() {
    var players = (function() {
      var players = [
        {id: 1, name: 'Jakub'},
        {id: 2, name: 'Palo'},
        {id: 3, name: 'Jozef'}
      ];

      return {
        createMatch: function (winId, looseId) {
          return {
            winner_id: players[winId].id,
            winner: players[winId],
            looser_id: players[looseId].id,
            looser: players[looseId]
          }
        }
      }
    })()

    var dummyMatches = [
      players.createMatch(0,1),
      players.createMatch(0,2),
      players.createMatch(1,2),
      players.createMatch(2,0),
      players.createMatch(1,0),
      players.createMatch(0,1)
    ];

    var res1 = mm.calcStatistics(1, dummyMatches);
    var res2 = mm.calcStatistics(2, dummyMatches);
    var res3 = mm.calcStatistics(3, dummyMatches);

    it('should return correct winStreaks', function() {
      assert(res1.winStreak == 2);
      assert(res2.winStreak == 1);
      assert(res3.winStreak == 1);
    })

    it('should return correct looseStreaks', function() {
      assert(res1.looseStreak == 2);
      assert(res2.looseStreak == 1);
      assert(res3.looseStreak == 2);
    })

    it('should return correct most wins against', function() {
      assert(res1.mostWinsAgainst == 'Palo');
      assert(res2.mostWinsAgainst == 'Jakub , Jozef');
      assert(res3.mostWinsAgainst == 'Jakub');
    })

    it('should return correct most loose against', function() {
      assert(res1.mostLostsAgainst == 'Jozef , Palo');
      assert(res2.mostLostsAgainst == 'Jakub');
      assert(res3.mostLostsAgainst == 'Jakub , Palo');
    })

    it('should return correct favourite player', function() {
      assert(res1.favouritePlayer == 'Palo');
      assert(res2.favouritePlayer == 'Jakub');
      assert(res3.favouritePlayer == 'Jakub');
    })
  })
});
