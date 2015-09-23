var q = require('q'),
  challongeAPI = require('../../config/config.json')['challongeSettings'],
  restler = require('restler'),
    db = require('../models');

module.exports = function() {

  var mainURL = (function(){
    var actualSets = challongeAPI[process.env.NODE_ENV || 'development'];
    return 'https://'+actualSets['USERNAME'] + ':' + actualSets['SECRET_KEY'] + '@api.challonge.com/api/';
  })();

  function createURL(routeString) {
    return mainURL + routeString + '.json';
  }

  /**
   * Send content to challonge API.
   * @param {'POST' || 'GET'} method
   * @param {Object} content
   * @returns {q.promise}
   */
  function sendContent(method, url, content) {
    var deffered = q.defer(),
        restlerPromise = null;

    if (method == 'POST') {
      restlerPromise = restler.postJson(createURL(url), content, {
        headers: {
          'Content-Length': Buffer.byteLength(JSON.stringify(content))
        }
      });
    }

    if (method == 'GET') {
      restlerPromise = restler.json(createURL(url), content, {
        headers: {
          'Content-Length': Buffer.byteLength(JSON.stringify(content))
        }
      });
    }

    if (method == 'DELETE') {
      restlerPromise = restler.del(createURL(url));
    }

    restlerPromise
      .on('success', function(data){
        deffered.resolve(data);
      })
      .on('error', function(err){
        deffered.reject(err);
      })
      .on('fail', function(err){
        deffered.reject(err);
      });

    return deffered.promise;
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

      var content = {
        tournament: {
          name: name,
          tournament_type: type,
          url: url,
          start_at: startAt
        }
      };

      return sendContent('POST', 'tournaments', content);
    },

    /**
     * Register participant into tournament.
     * @param {db.User} user
     * @param {integer} tournamentId
     * @returns {q.promise [challongeApiResponse, createdParticipantInstance]}
     */
    addParticipant: function(user, tournamentId) {
      var deferInternal = q.defer(),
          deferResult = q.defer();
      //check if user isn't already registered for tournament
      q.all([
        db.Participant.find({
          where: {
            user_id: user.id,
            tournament_id: tournamentId
          }
        }),
        db.Tournament.find({
          where: {
            id: tournamentId
          }
        })
      ])
      .then(function(result){
        if (result[0]) {
          deferInternal.reject("Already joined into tournament");
        } else {
          deferInternal.resolve(result[1]);
        }
      }).catch(function(err){
        deferInternal.reject(err);
      });

      deferInternal.promise.then(function(data){
        //register user to tournament
        var content = {
          participant: {
            name: user.name,
            seed: 1
          }
        };
        var url = 'tournaments/' + data.challonge_id + '/participants';
        sendContent('POST', url, content)
          .then(function(data){
            db.Participant.create({
              tournament_id: tournamentId,
              user_id: user.id,
              challonge_id: data.participant.id
            }).then(function(data){
              deferResult.resolve(data);
            }).catch(function(err){
              deferResult.reject(err);
            })
          })
          .catch(function(err){
            deferResult.reject(err);
          });
      }).catch(function(err){
        deferResult.reject(err);
      });
      return  deferResult.promise;
    },

    /**
     * Remove participant from tournament.
     * @param {db.User} userId
     * @param {integer} tournamentId
     * @returns {q.promise [challongeAPIresponse, destroyParticipantResult]}
     */
    removeParticipant: function(user, tournamentId) {
      var deferInternal = q.defer(),
          deferResult = q.defer();

      //check if user is registered to tournament
      db.Participant.find({
        where: {
          user_id: user.id,
          tournament_id: tournamentId
        },
        include: [
          {model: db.Tournament, as: 'tournament'}
        ]
      }).then(function(participant){
        if (participant)
          deferInternal.resolve(participant);
        else
          deferInternal.reject('Not registered into tournament');
      }).catch(function(err){
        deferInternal.reject(err);
      });

      deferInternal.promise.then(function(participant){
        //unregister user
        //send challonge api for destroy
        //remove participant
        var url = 'tournaments/' + participant.tournament.challonge_id + '/participants/' + participant.challonge_id;
        q.all([
          sendContent('DELETE', url, {}),
          participant.destroy()
        ])
          .then(function(data){
            deferResult.resolve(data);
          })
          .catch(function(err){
            deferResult.reject(err);
          })
      })
        .catch(function(err){
          deferResult.reject(err);
        });

      return deferResult.promise;
    },

    /**
     * Starts tournament. (can't join after)
     * @param {integer} userId
     * @param {integer} tournamentId
     */
    startTournament: function(userId, tournamentId) {
      //check if user is owner of tournament

      //start tournament

    },

    /**
     * Deletes tournament.
     * @param userId
     * @param tournamentId
     */
    deleteTournament: function(userId, tournamentId) {
      //check if user is owner of tournament

      //delete tournament

    },

    /**
     * Submits match result into tournament.
     */
    submitMatchResult: function(tournamentId, winnerId, looserId, score) {

    }
  }
}
