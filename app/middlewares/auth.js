/**
 * Default middleware used for authentication of request.
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
module.exports = function(req, res, next) {
  if (req.isAuthenticated())
    return next();

  res.redirect('/auth/login');
}
