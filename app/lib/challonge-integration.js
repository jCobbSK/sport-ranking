var q = require('q'),
  challongeAPI = require('../../config/config.json')['challongeSettings'],
  restler = require('restler');

module.exports = function() {

  var mainURL = (function(){
    var actualSets = challongeAPI[process.env.NODE_ENV || 'development'];
    return 'https://'+actualSets['USERNAME'] + ':' + actualSets['SECRET_KEY'] + '@api.challonge.com/api/';
  })();

  function createURL(routeString) {
    return mainURL + routeString + '.json';
  }

  return {
    /**
     * Create tournament in challonge system.
     * @param {string} name
     * @param {string} url
     * @param {string} type
     * @param {datetime} startAt
     * @returns q.promise with result {
     *  challongeId: [integer],
     *  challongeUrl: [string]
     * }
     */
    createTournament: function(name, url, type, startAt) {
      var deffered = q.defer();

      var content = {
        tournament: {
          name: name,
          tournament_type: type,
          url: url,
          start_at: startAt
        }
      };

      restler.postJson(createURL('tournaments'), content, {
        headers: {
          'Content-Length': Buffer.byteLength(JSON.stringify(content))
        }
      })
        .on('success', function(data, response) {
          deffered.resolve(data);
        })
        .on('fail', function(err, response) {
          deffered.reject(err);
        })
        .on('error', function(err, response) {
          deffered.reject(err);
        });

      return deffered.promise;
    }
  }
}
