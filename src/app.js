const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { config } = require('./config/env');
const { requestContext } = require('./middleware/request-context');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');
const { ForbiddenError } = require('./utils/app-error');

function createCorsOptions() {
  return {
    origin(origin, callback) {
      if (!origin || config.appOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new ForbiddenError('El origen de la solicitud no está autorizado.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'Content-Disposition'],
    maxAge: 86400
  };
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.locals.sessionCookieName = config.session.name;

  app.use(requestContext);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors(createCorsOptions()));
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
