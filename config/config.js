var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
    env = process.env.NODE_ENV || 'development';

var config = {
  development: {
    root: rootPath,
    app: {
      name: 'documents'
    },
    port: 3500,
    db: 'postgres://jakubkanitra:roh4dZi3@localhost/sport-ranking'
  },

  test: {
    root: rootPath,
    app: {
      name: 'documents'
    },
    port: 3500,
    db: 'postgres://jakubkanitra:roh4dZi3@localhost/sport-ranking'
  },

  production: {
    root: rootPath,
    app: {
      name: 'documents'
    },
    port: 3500,
    db: 'postgres://postgres:roh4dZi3@localhost/sport-ranking'
  }
};

module.exports = config[env];
