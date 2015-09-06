/**
 * Function for creating github-like pagination.
 * @param {integer} actualPage
 * @param {integer} numberOfPages
 * @param {object} settings
 *  @param {string} disabledClass
 *  @param {string} activeClass
 *  @param {function} createLink
 *    @param {integer} index
 */
module.exports = function(actualPage, numberOfPages, settings) {

  function createLink(index, isActive, isDisabled, content) {
    var href = (index || index == 0) ? settings.createLink(index) : '#',
        classes = settings.staticClasses.concat([isActive ? settings.activeClass : '', isDisabled ? settings.disabledClass : '']).join(' '),
        content = (content) ? content : index + 1;
    return '<a '+
      ((href) ? 'href="' + href + '"' : '') +
      'class="' + classes + '"' +
      '>' + content + '</a>';
  }

  function createArrayOfLinks(startIndex, length) {
    var res = [];
    for (var i=startIndex; i<startIndex + length; i++) {
      res.push(createLink(i));
    }
    return res;
  }

  function createDummyButton() {
    return createLink(null, null, true, '...');
  }

  var result = [];
  var activePrevious = actualPage != 0;
  var activeNext = actualPage < numberOfPages - 1;

  result.push(createLink(actualPage, true));
  var left = 1, right = 1;
  while(left + right < 6 && left + right <= numberOfPages) {
    if (actualPage - left >= 0) {
      result.unshift(createLink(actualPage - left));
      left++;
    }
    if (actualPage + right + 1 <= numberOfPages) {
      result.push(createLink(actualPage + right));
      right++;
    }
  }

  if (actualPage - left >= 2) {
    //insert dummy button
    result.unshift(createDummyButton());
    result = createArrayOfLinks(0,2).concat(result);
  } else {
    result = createArrayOfLinks(0, actualPage + 1 - left).concat(result);
  }

  if (numberOfPages - (actualPage + right) > 2) {
    result.push(createDummyButton());
    result = result.concat(createArrayOfLinks(numberOfPages - 2, 2));
  } else {
    result = result.concat(createArrayOfLinks(actualPage + right, numberOfPages - (actualPage + right) ));
  }

  if (numberOfPages > 1) {
    result.unshift(createLink(actualPage - 1, null, !activePrevious, 'Previous' ));
    result.push(createLink(actualPage + 1, null, !activeNext, 'Next'));
  }

  return result.join(' ');
}
