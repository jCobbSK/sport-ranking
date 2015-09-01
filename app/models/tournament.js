'use strict';
module.exports = function(sequelize, DataTypes) {
  var Tournament = sequelize.define('Tournament', {
    creator_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    type: DataTypes.STRING,
    note: DataTypes.STRING,
    cancelled: {
      type:DataTypes.BOOLEAN,
      defaultValue: false
    },
    winner_id: DataTypes.INTEGER,
    challonge_url: DataTypes.STRING,
    challonge_id: DataTypes.INTEGER,
    startsAt: DataTypes.DATE,
    isStarted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        Tournament.hasMany(models.Participant, {
          foreignKey: 'tournament_id',
          as: 'participants'
        });

        Tournament.belongsTo(models.User, {
          foreignKey: 'creator_id',
          as: 'creator'
        });

        Tournament.belongsTo(models.User, {
          foreignKey: 'winner_id',
          as: 'winner'
        });
      }
    }
  });
  return Tournament;
};
