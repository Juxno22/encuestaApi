const { DateTime } = require('luxon');
const { config } = require('../config/env');
const { ValidationError } = require('./app-error');

function parseBoundary(value, boundary) {
  if (!value) return null;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = isDateOnly
    ? DateTime.fromISO(value, { zone: config.reportTimezone })[boundary === 'from' ? 'startOf' : 'endOf']('day')
    : DateTime.fromISO(value, { zone: config.reportTimezone, setZone: true });

  if (!parsed.isValid) {
    throw new ValidationError(`La fecha "${value}" no es válida.`);
  }

  return parsed.toUTC().toFormat('yyyy-LL-dd HH:mm:ss.SSS');
}

function normalizeDateFilters({ from, to }) {
  const fromUtc = parseBoundary(from, 'from');
  const toUtc = parseBoundary(to, 'to');
  if (fromUtc && toUtc && fromUtc > toUtc) {
    throw new ValidationError('La fecha inicial no puede ser posterior a la fecha final.');
  }
  return { fromUtc, toUtc };
}

function normalizeSurveyStartedAt(value) {
  const now = DateTime.utc();
  if (!value) return now.toFormat('yyyy-LL-dd HH:mm:ss.SSS');

  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) return now.toFormat('yyyy-LL-dd HH:mm:ss.SSS');

  const utc = parsed.toUTC();
  if (utc > now.plus({ minutes: 2 }) || utc < now.minus({ hours: 4 })) {
    return now.toFormat('yyyy-LL-dd HH:mm:ss.SSS');
  }

  return utc.toFormat('yyyy-LL-dd HH:mm:ss.SSS');
}

module.exports = {
  normalizeDateFilters,
  normalizeSurveyStartedAt
};
