const adminRepository = require('../repositories/admin.repository');
const { hashIp } = require('../utils/crypto');
const { logger } = require('../utils/logger');

async function writeAuditLog({ req, adminUserId, action, entityType, entityId, metadata }) {
  try {
    await adminRepository.insertAuditLog({
      adminUserId,
      action,
      entityType,
      entityId,
      metadata,
      ipHash: hashIp(req?.ip)
    });
  } catch (error) {
    logger.warn('audit_log_failed', {
      action,
      adminUserId,
      message: error.message
    });
  }
}

module.exports = { writeAuditLog };
