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
const { validateAndNormalizeAnswers } = require('../src/services/survey.service');

const survey = {
  questions: [
    {
      id: 1,
      code: 'RATING',
      type: 'rating',
      required: true,
      minValue: 1,
      maxValue: 10,
      options: []
    },
    {
      id: 2,
      code: 'CHOICE',
      type: 'single_choice',
      required: true,
      options: [{ id: 10, code: 'YES' }, { id: 11, code: 'NO' }]
    },
    {
      id: 3,
      code: 'COMMENT',
      type: 'long_text',
      required: false,
      options: []
    }
  ]
};

test('normaliza calificaciones, opciones y comentarios', () => {
  const result = validateAndNormalizeAnswers(survey, {
    RATING: 10,
    CHOICE: 'YES',
    COMMENT: 'Buen servicio'
  });
  assert.equal(result.length, 3);
  assert.equal(result[0].numericValue, 10);
  assert.equal(result[1].optionId, 10);
  assert.equal(result[2].textValue, 'Buen servicio');
});

test('rechaza preguntas obligatorias faltantes', () => {
  assert.throws(() => validateAndNormalizeAnswers(survey, { RATING: 10 }));
});
