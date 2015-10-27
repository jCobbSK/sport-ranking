'use strict';
module.exports = function(sequelize, DataTypes) {
  var Sport = sequelize.define('Sport', {
    name: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        Sport.hasMany(models.Match, {
          foreignKey: 'sport_id',
          as: 'matches'
        });
      }
    }
  });
  return Sport;
};
