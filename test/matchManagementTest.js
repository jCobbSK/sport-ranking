var assert = require("assert"),
  mm = require('../app/lib/matchManagement');

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
  });
});
