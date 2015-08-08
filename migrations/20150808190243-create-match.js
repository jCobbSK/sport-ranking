'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('Matches', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      submitter_id: {
        type: Sequelize.INTEGER
      },
      winner_id: {
        type: Sequelize.INTEGER
      },
      looser_id: {
        type: Sequelize.INTEGER
      },
      sport_id: {
        type: Sequelize.INTEGER
      },
      score: {
        type: Sequelize.STRING
      },
      winner_points: {
        type: Sequelize.INTEGER
      },
      looser_points: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: function(queryInterface, Sequelize) {
    return queryInterface.dropTable('Matches');
  }
};