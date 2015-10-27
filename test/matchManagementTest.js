var assert = require("assert"),
  mm = require('../app/server/lib/matchManagement');

describe('Match Management', function() {
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

    console.log(res1);
    console.log(res2);
    console.log(res3);

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
