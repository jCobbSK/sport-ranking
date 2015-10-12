var assert  = require('assert'),
    db = require('../app/models'),
    challongeAPI = require('../app/lib/challonge-integration')();

//describe('Challonge integration', function() {
//  describe('#createTournament', function() {
//    it('should create tournament on challonge side', function(done){
//
//    })
//  })
//
//  describe('#addParticipant', function() {
//    it('should addParticipant to tournament if not already joined', function(done){
//
//    })
//
//    it('shouldnt addParticipant if already joined', function(done) {
//
//    })
//  })
//
//  describe('#removeParticipant', function() {
//    it('should remove participant if joined in tournament', function(done) {
//
//    })
//  })
//
//  describe('#startTournament', function() {
//    it('should start tournament', function(done) {
//
//    })
//  })
//
//  describe('#deleteTournament', function() {
//    it('should delete tournament', function(done) {
//
//    })
//  })
//
//  describe('#getMatchesForTournament', function() {
//    it('should return all available matches for started tournament', function(done){
//
//    })
//  })
//
//  describe('#submitMatchResult', function() {
//    it('should submit one match to tournament', function(done) {
//
//    })
//  })
//})
