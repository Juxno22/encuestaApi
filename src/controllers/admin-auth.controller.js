const authService = require('../services/auth.service');
const { writeAuditLog } = require('../services/audit.service');
const { ensureCsrfToken } = require('../middleware/csrf');

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

async function login(req, res) {
  const user = await authService.authenticate(req.body.username, req.body.password);
  await regenerateSession(req);
  req.session.adminUser = user;
  const csrfToken = ensureCsrfToken(req);
  await saveSession(req);

  await writeAuditLog({
    req,
    adminUserId: user.id,
    action: 'ADMIN_LOGIN',
    entityType: 'admin_user',
    entityId: String(user.id)
  });

  res.json({
    success: true,
    data: {
      user,
      csrfToken
    }
  });
}

async function logout(req, res) {
  const user = req.adminUser;
  await writeAuditLog({
    req,
    adminUserId: user.id,
    action: 'ADMIN_LOGOUT',
    entityType: 'admin_user',
    entityId: String(user.id)
  });
  await destroySession(req);
  res.clearCookie(req.app.locals.sessionCookieName, { path: '/api/admin' });
  res.status(204).send();
}

async function me(req, res) {
  res.json({ success: true, data: { user: req.adminUser } });
}

async function csrf(req, res) {
  const csrfToken = ensureCsrfToken(req);
  await saveSession(req);
  res.json({ success: true, data: { csrfToken } });
}

module.exports = {
  login,
  logout,
  me,
  csrf
};
