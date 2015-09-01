'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('Matches', 'deleteRequests', {
      type: Sequelize.STRING,
      defaultValue: '[]'
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Matches', 'deleteRequests');
  }
};
