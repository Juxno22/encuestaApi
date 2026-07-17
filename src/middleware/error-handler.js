const { AppError } = require('../utils/app-error');
const { logger } = require('../utils/logger');
const { config } = require('../config/env');

function notFoundHandler(req, _res, next) {
  next(new AppError(`No existe la ruta ${req.method} ${req.originalUrl}.`, 404, 'ROUTE_NOT_FOUND'));
}

function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;

  const operational = error instanceof AppError || error.isOperational;
  const statusCode = operational ? error.statusCode : 500;
  const code = operational ? error.code : 'INTERNAL_ERROR';
  const message = operational ? error.message : 'Ocurrió un error interno.';

  logger.error('request_error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    message: error.message,
    stack: config.isProduction ? undefined : error.stack
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: operational ? error.details : undefined,
      requestId: req.requestId
    }
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
