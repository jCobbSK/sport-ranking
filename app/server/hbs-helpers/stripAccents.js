var removeDiacritics = require('diacritics');
module.exports = function(params) {
  return removeDiacritics.remove(params);
}
