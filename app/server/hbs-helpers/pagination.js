var ghp = require('../lib/githubPagination');
module.exports = function(actualPage, numberOfPages) {
  return ghp(actualPage, numberOfPages, {
    disabledClass: 'disabled',
    activeClass: 'btn-primary',
    staticClasses: ['btn', 'btn-default'],
    createLink: function(i) {
      return '/matches?page='+i;
    }
  });
};
