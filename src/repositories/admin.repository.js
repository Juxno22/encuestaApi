const { query } = require('../config/database');

async function findActiveUserByLogin(login) {
  const rows = await query(
    `SELECT id,
            username,
            email,
            password_hash AS passwordHash,
            role,
            is_active AS isActive
       FROM admin_users
      WHERE is_active = 1
        AND (username = ? OR email = ?)
      LIMIT 1`,
    [login, login]
  );
  return rows[0] || null;
}

async function updateLastLogin(userId) {
  await query(
    `UPDATE admin_users
        SET last_login_at = UTC_TIMESTAMP(3)
      WHERE id = ?`,
    [userId]
  );
}

async function insertAuditLog(data) {
  await query(
    `INSERT INTO admin_audit_logs
      (admin_user_id, action, entity_type, entity_id, metadata_json, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.adminUserId || null,
      data.action,
      data.entityType || null,
      data.entityId || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.ipHash || null
    ]
  );
}

module.exports = {
  findActiveUserByLogin,
  updateLastLogin,
  insertAuditLog
};
