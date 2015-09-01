'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('Tournaments', 'isStarted', {
      type: Sequelize.BOOLEAN
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Tournaments', 'isStarted');
  }
};
