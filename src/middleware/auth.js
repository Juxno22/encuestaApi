const { UnauthorizedError, ForbiddenError } = require('../utils/app-error');

function requireAdmin(req, _res, next) {
  if (!req.session?.adminUser) {
    return next(new UnauthorizedError('Inicia sesión para continuar.'));
  }
  req.adminUser = req.session.adminUser;
  return next();
}

function requireRole(...roles) {
  return function roleMiddleware(req, _res, next) {
    if (!req.adminUser || !roles.includes(req.adminUser.role)) {
      return next(new ForbiddenError());
    }
    return next();
  };
}

module.exports = {
  requireAdmin,
  requireRole
};
