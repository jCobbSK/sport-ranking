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

    if (method == 'PUT') {
      restlerPromise = restler.put(createURL(url), content, {
        headers: {
          'Content-Length': Buffer.byteLength(JSON.stringify(content))
        }
      });
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
                  deferResult.resolve();
                })
                .catch(function(err){
                    deferResult.reject(err);
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
     * Returns all matches for specific tournament if user is creator of tournament, if user is participant in tournament,
     * it returns only he's open matches, otherwise returns empty array;
     * @param {integer} [required] tournamentId
     * @param {db.User} [optional] user
     * @returns {q.promise} -- structure of resolve object is:
     *    [{
     *      matchId: int,
     *      player1:{
     *        username: string,
     *        userId: int,
     *        challongeId: int
     *      },
     *      player2: {
     *        username: string,
     *        userId: int,
              challongeId: int
     *      }
     *    }]
     */
    getMatchesForTournament: function(tournamentId, user) {
      var defer = q.defer();

      //returns promise with 'owner' | 'participant' | 'nothing'
      function determineStatusOfUser() {
        var defer = q.defer();
        q.all([
          db.sequelize.query(`SELECT "Tournaments"."challonge_id" FROM "Tournaments" WHERE "Tournaments"."id" = ${tournamentId}`),
          db.sequelize.query(`SELECT "Participants"."challonge_id" FROM "Participants" WHERE "Participants"."user_id" = ${user.id} AND "Participants"."tournament_id" = ${tournamentId}`)
        ]).then(function(res){
          var tournament = res[0][0][0];
          if (tournament) {
            var returnObj = {tournamentChallongeId: tournament.challonge_id};
            if (tournament.creator_id == user.id) {
              returnObj['relation'] = 'creator';
            } else if (res[1][0]){
              returnObj['relation'] = 'participant';
              returnObj['challongeId'] = res[1][0][0].challonge_id;
            } else {
              returnObj['relation'] = 'nothing';
            }
            defer.resolve(returnObj);
          } else {
            defer.reject('Tournament not found');
          }
        });

        return defer.promise;
      }

      function mapMatches(matchesPromise) {
        var defer = q.defer();

        matchesPromise
          .then(function(matches){
            var distinctPlayersChallongeIds = new Set();
            matches.forEach(function(matchObject) {
              var match = matchObject.match;
              distinctPlayersChallongeIds.add(match.player1_id);
              distinctPlayersChallongeIds.add(match.player2_id);
            });

            var players = Array.from(distinctPlayersChallongeIds); //convert to plain array
            var query = `SELECT "Users".*, "Participants"."challonge_id" FROM "Participants" LEFT JOIN "Users" ON "Participants"."user_id" = "Users"."id" WHERE "Participants"."challonge_id" IN (${players.join(',')})`;
            db.sequelize.query(query)
              .then(function(users){
                 var users = users[0];
                 defer.resolve(matches.map(function(matchObj){
                  var match = matchObj.match;
                  var player1 = users.find(function(u){
                    return u.challonge_id == match.player1_id;
                  });
                  var player2 = users.find(function(u){
                    return u.challonge_id == match.player2_id;
                  });
                  return {
                    matchId: match.id,
                    player1: {
                      username: player1.name,
                      userId: player1.id,
                      challongeId: player1.challonge_id
                    },
                    player2: {
                      username: player2.name,
                      userId: player2.id,
                      challongeId: player2.challonge_id
                    }
                  }
                }));
              })
              .catch(function(err){
                defer.reject(err);
              })
          })
          .catch(function(err){
            defer.reject(err);
          });

        return defer.promise;
      }

      determineStatusOfUser()
        .then(function(userRelation){
          var matches;
          switch(userRelation['relation']) {
            case 'creator':
              matches = mapMatches(sendContent('GET', `tournaments/${userRelation.tournamentChallongeId}/matches`, {state: 'open'}));
              break;
            case 'participant':
              matches = mapMatches(sendContent('GET', `tournaments/${userRelation.tournamentChallongeId}/matches`, {state: 'open', participant_id: userRelation.challonge_id}));
              break;
          }

          if (matches) {
            matches.then(function(res){defer.resolve(res);}).catch(function(err){defer.reject(err)});
          } else {
            defer.resolve([]);
          }
        })
        .catch(function(){
          defer.reject();
        })

      return defer.promise;
    },

    /**
     * Submits match result into tournament.
     * @param {int} tournamentId = challonge_id of tournament
     * @param {int} matchId = challonge_id of match
     * @param {int} winnerId = challonge_id of winner
     * @param {string} score = csv format of score [e.q. "1-3,3-0,3-2"] - matches player1 must be first
     */
    submitMatchResult: function(tournamentId, matchId, winnerId, score) {
      return sendContent('PUT', `tournaments/${tournamentId}/matches/${matchId}`,{
        match: {
          winner_id: winnerId,
          scores_csv: score
        }
      });
    }
  }
}
