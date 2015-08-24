'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    return queryInterface.addColumn('PointHistories', 'originCreatedAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      });
  },

  down: function (queryInterface, Sequelize) {
    queryInterface.removeColumn('PointHistories', 'originCreatedAt');
  }
};
