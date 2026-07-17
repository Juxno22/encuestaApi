const bcrypt = require('bcryptjs');
const adminRepository = require('../repositories/admin.repository');
const { UnauthorizedError } = require('../utils/app-error');

async function authenticate(login, password) {
  const user = await adminRepository.findActiveUserByLogin(login);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError('Usuario o contraseña incorrectos.');
  }

  await adminRepository.updateLastLogin(user.id);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };
}

module.exports = { authenticate };
