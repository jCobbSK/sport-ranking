'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('Tournaments', 'startsAt', {
      type: Sequelize.DATE
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Tournaments', 'startsAt');
  }
};
