const crypto = require('node:crypto');
const { ForbiddenError } = require('../utils/app-error');
const { safeEqualStrings } = require('../utils/crypto');

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
  }
  return req.session.csrfToken;
}

function requireCsrf(req, _res, next) {
  const expected = req.session?.csrfToken;
  const received = req.get('x-csrf-token');
  if (!expected || !received || !safeEqualStrings(expected, received)) {
    return next(new ForbiddenError('El token de seguridad es inválido. Actualiza la página e inténtalo nuevamente.'));
  }
  return next();
}

module.exports = {
  ensureCsrfToken,
  requireCsrf
};
