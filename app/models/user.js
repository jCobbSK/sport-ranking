'use strict';
module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    name: DataTypes.STRING,
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 1600
    },
    facebook_token: DataTypes.STRING,
    xp: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    photo: {
      type: DataTypes.STRING
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        User.hasMany(models.Match, {
          foreignKey: 'winner_id',
          as: 'wins'
        });

        User.hasMany(models.Match, {
          foreignKey: 'looser_id',
          as: 'losses'
        });

        User.hasMany(models.Match, {
          foreignKey: 'submitter_id',
          as: 'submits'
        });
      }
    }
  });
  return User;
};
