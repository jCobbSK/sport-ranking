var q = require('q'),
  request = require('request'),
  challongeAPI = require('../../config/config.json')['challongeSettings'];

module.exports = function() {

  var mainURL = (function(){
    var actualSets = challongeAPI[process.env.NODE_ENV || 'development'];
    return "https://" + actualSets['USERNAME'] + ':' + actualSets['SECRET_KEY'] + '@api.challonge.com/v1/';
  })();

  function createURL(routeString) {
    return mainURL + routeString + '.json';
  }

  return {
    createTournament: function(name) {

    }
  }
}
