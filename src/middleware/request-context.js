const { randomUUID } = require('node:crypto');
const { logger } = require('../utils/logger');

function requestContext(req, res, next) {
  const requestId = req.get('x-request-id') || randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      elapsedMs: Number(elapsedMs.toFixed(2))
    });
  });

  next();
}

module.exports = { requestContext };
