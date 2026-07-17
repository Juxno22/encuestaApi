process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test';
process.env.SESSION_SECRET = 'session-secret-de-pruebas-123456789012345';
process.env.IP_HASH_SECRET = 'ip-secret-de-pruebas-12345678901234567890';
process.env.TRIVIA_TOKEN_SECRET = 'trivia-secret-de-pruebas-123456789012345';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTriviaAccessToken, verifyTriviaAccessToken } = require('../src/utils/tokens');

test('crea y valida un token de acceso a trivia', () => {
  const responseId = '27c552b2-8e79-40f7-8cb9-06de04134cbe';
  const token = createTriviaAccessToken(responseId);
  const payload = verifyTriviaAccessToken(token);
  assert.equal(payload.sub, responseId);
  assert.equal(payload.purpose, 'trivia');
});

test('rechaza un token alterado', () => {
  const token = createTriviaAccessToken('27c552b2-8e79-40f7-8cb9-06de04134cbe');
  assert.throws(() => verifyTriviaAccessToken(`${token}x`));
});
