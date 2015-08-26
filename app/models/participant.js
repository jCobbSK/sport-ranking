'use strict';
module.exports = function(sequelize, DataTypes) {
  var Participant = sequelize.define('Participant', {
    tournament_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    challonge_id: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        Participant.belongsTo(models.User, {
          foreignKey: 'user_id',
          as: 'user'
        });

        Participant.belongsTo(models.Tournament, {
          foreignKey: 'tournament_id',
          as: 'tournament'
        });
      }
    }
  });
  return Participant;
};
