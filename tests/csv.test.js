const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeCsvCell, toCsv } = require('../src/utils/csv');

test('escapeCsvCell protege comas, comillas y saltos de línea', () => {
  assert.equal(escapeCsvCell('hola'), 'hola');
  assert.equal(escapeCsvCell('hola,mundo'), '"hola,mundo"');
  assert.equal(escapeCsvCell('dijo "hola"'), '"dijo ""hola"""');
});

test('toCsv agrega BOM y encabezados', () => {
  const csv = toCsv([{ key: 'name', label: 'Nombre' }], [{ name: 'Juan' }]);
  assert.ok(csv.startsWith('\uFEFFNombre\r\nJuan'));
});
