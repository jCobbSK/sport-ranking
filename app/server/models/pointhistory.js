'use strict';
var moment = require('moment');
module.exports = function(sequelize, DataTypes) {
  var PointHistory = sequelize.define('PointHistory', {
    user_id: DataTypes.INTEGER,
    points: DataTypes.INTEGER,
    originCreatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        PointHistory.belongsTo(models.User, {
          foreignKey: 'user_id',
          as: 'user'
        })
      }
    }
  });
  return PointHistory;
};
