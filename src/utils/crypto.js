const crypto = require('node:crypto');
const { config } = require('../config/env');

function hashIp(ipAddress) {
  if (!ipAddress) return null;
  return crypto.createHmac('sha256', config.ipHashSecret).update(String(ipAddress)).digest('hex');
}

function createOpaqueId() {
  return crypto.randomUUID();
}

function safeEqualStrings(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  hashIp,
  createOpaqueId,
  safeEqualStrings
};
