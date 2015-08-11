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
        res += didWin(firstUser[i], secondUser[i]);
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
  }
}
