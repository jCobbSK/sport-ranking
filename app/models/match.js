'use strict';
module.exports = function(sequelize, DataTypes) {
  var Match = sequelize.define('Match', {
    submitter_id: DataTypes.INTEGER,
    winner_id: DataTypes.INTEGER,
    looser_id: DataTypes.INTEGER,
    sport_id: DataTypes.INTEGER,
    score: DataTypes.STRING,
    winner_points: DataTypes.INTEGER,
    looser_points: DataTypes.INTEGER,
    deleteRequests: {
      type: DataTypes.STRING,
      defaultValue: '[]'
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        Match.belongsTo(models.User, {
          foreignKey: 'winner_id',
          as: 'winner'
        });

        Match.belongsTo(models.User, {
          foreignKey: 'looser_id',
          as: 'looser'
        });

        Match.belongsTo(models.User, {
          foreignKey: 'submitter_id',
          as: 'submitter'
        });

        Match.belongsTo(models.Sport, {
          foreignKey: 'sport_id',
          as: 'sport'
        });
      }
    }
  });
  return Match;
};
