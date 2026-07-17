const { rateLimit } = require('express-rate-limit');

function jsonHandler(message) {
  return (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message
      }
    });
  };
}

const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Se realizaron demasiadas consultas. Espera un momento.')
});

const surveySubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Se alcanzó el límite temporal de encuestas desde este dispositivo.')
});

const triviaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Se realizaron demasiadas operaciones de trivia. Espera un momento.')
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Demasiados intentos de acceso. Inténtalo más tarde.')
});

module.exports = {
  publicReadLimiter,
  surveySubmitLimiter,
  triviaLimiter,
  adminLoginLimiter
};
