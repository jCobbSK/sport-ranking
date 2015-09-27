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

  /**
   * Check if user is owner of tournament and therefore can modify it (start | delete).
   * @param user
   * @param tournamentId
   * @returns {q.promise}
   */
  function isOwnerOfTournament(user, tournamentId) {
    var defer = q.defer();

    db.Tournament.findById(tournamentId)
      .then(function(tournament){
        if (tournament && tournament.creator_id == user.id)
          defer.resolve(tournament);
        else
          defer.reject('Logged user is not owner of tournament or tournament doesn\'t exist');
      })
      .catch(function(err){
        defer.reject(err);
      });

    return defer.promise;
  }

  return {
    /**
     * Create tournament in challonge system and create instance in application database.
     * @param {db.User} user
     * @param {string} name
     * @param {string} url
     * @param {string} type
     * @param {datetime} startAt
     * @param {string} note
     * @returns q.promise
     */
    createTournament: function(user, name, url, type, startAt, note) {

      var defer = q.defer();

      var content = {
        tournament: {
          name: name,
          tournament_type: type,
          url: url,
          start_at: startAt
        }
      };

      sendContent('POST', 'tournaments', content)
        .then(function(data){
          //data consists of challongeUrl, challongeId
          var challongeUrl = data.tournament.full_challonge_url,
              challongeId = data.tournament.id;
          q.all([
            db.Tournament.create({
              creator_id: user.id,
              name: name,
              type: type,
              note: note,
              challonge_url: challongeUrl,
              challonge_id: challongeId,
              startsAt: startsAt
            })
          ])
            .then(function(result){
              defer.resolve(result);
            })
        })
        .catch(function(err){
          defer.reject({challongeError:err.errors.join(' ; ')});
        });

      return defer.promise;
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
            deferResult.reject({challongeError:err.errors.join(' ; ')});
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
          sendContent('DELETE', url, {}).then(function(){
            participant.destroy().then(function(){
              deferResult.resolve();
            }).catch(function(err){
              deferResult.reject(err);
            })
          }).catch(function(err){
            deferResult.reject({challongeError:err.errors.join(' ; ')});
          })
      })
        .catch(function(err){
          deferResult.reject(err);
        });

      return deferResult.promise;
    },

    /**
     * Starts tournament. (can't join after)
     * @param {db.User} user
     * @param {integer} tournamentId
     */
    startTournament: function(user, tournamentId) {
      //check if user is owner of tournament
      var deferResult = q.defer();

      //start tournament
      isOwnerOfTournament(user, tournamentId)
        .then(function(tournament){
          //start tournament
            sendContent('POST', 'tournaments/' + tournament.challonge_id + '/start', {})
              .then(function(){
                tournament.updateAttributes({
                  isStarted: true
                }).then(function(){
                  defer.resolve();
                })
                .catch(function(err){
                  defer.reject(err);
                })
              })
              .catch(function(){
                deferResult.reject({challongeError:err.errors.join(' ; ')});
              })
        })
        .catch(function(err){
          deferResult.reject(err);
        });

      return deferResult.promise;
    },

    /**
     * Deletes tournament.
     * @param {db.User} user
     * @param {integer} tournamentId
     * @returns {q.promise}
     */
    deleteTournament: function(user, tournamentId) {
      var defer = q.defer();
      //check if user is owner of tournament
      isOwnerOfTournament(user, tournamentId)
        .then(function(tournament){
            sendContent('DELETE', 'tournaments/'+tournament.challonge_id, {})
              .then(function(){
                tournament.destroy().then(function(){
                  defer.resolve();
                })
                  .catch(function(err){
                    defer.reject(err);
                  })
              })
              .catch(function(err){
                defer.reject({challongeError:err.errors.join(' ; ')});
              })
        })
        .catch(function(err){
          return defer.reject(err);
        });

      return defer.promise;
    },

    /**
     * Returns all matches for specific tournament. Optionally filtered only for specific user.
     * @param {integer} [required] tournamentId
     * @param {db.User} [optional] user
     * @returns {q.promise}
     */
    getMatchesForTournament: function(tournamentId, user) {

    },

    /**
     * Submits match result into tournament.
     */
    submitMatchResult: function(tournamentId, winnerId, looserId, score) {

    }
  }
}
