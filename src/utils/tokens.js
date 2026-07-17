const crypto = require('node:crypto');
const { config } = require('../config/env');
const { UnauthorizedError } = require('./app-error');
const { safeEqualStrings } = require('./crypto');

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function sign(encodedPayload) {
  return crypto.createHmac('sha256', config.trivia.tokenSecret).update(encodedPayload).digest('base64url');
}

function createTriviaAccessToken(responsePublicId) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    sub: responsePublicId,
    purpose: 'trivia',
    iat: nowSeconds,
    exp: nowSeconds + config.trivia.tokenTtlMinutes * 60
  };
  const encodedPayload = encode(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyTriviaAccessToken(token) {
  try {
    const [encodedPayload, signature] = String(token || '').split('.');
    if (!encodedPayload || !signature || !safeEqualStrings(signature, sign(encodedPayload))) {
      throw new Error('Firma inválida.');
    }

    const payload = decode(encodedPayload);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.purpose !== 'trivia' || !payload.sub || !payload.exp || payload.exp < nowSeconds) {
      throw new Error('Token vencido o inválido.');
    }
    return payload;
  } catch {
    throw new UnauthorizedError('El acceso a la trivia no es válido o ya venció.');
  }
}

module.exports = {
  createTriviaAccessToken,
  verifyTriviaAccessToken
};
