const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}, z.boolean());

const integerFromEnv = (minimum, maximum) => z.coerce.number().int().min(minimum).max(maximum);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: integerFromEnv(1, 65535).default(3000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),
  APP_ORIGINS: z.string().default('http://localhost:5500,http://127.0.0.1:5500'),

  DB_HOST: z.string().min(1),
  DB_PORT: integerFromEnv(1, 65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1).default('diagsa_encuestas'),
  DB_CONNECTION_LIMIT: integerFromEnv(1, 100).default(10),

  SESSION_SECRET: z.string().min(32),
  SESSION_NAME: z.string().min(1).default('diagsa.admin.sid'),
  SESSION_TTL_HOURS: integerFromEnv(1, 168).default(8),
  SESSION_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SESSION_SECURE: booleanFromEnv.default(false),

  IP_HASH_SECRET: z.string().min(32),
  TRIVIA_TOKEN_SECRET: z.string().min(32),
  TRIVIA_TOKEN_TTL_MINUTES: integerFromEnv(5, 1440).default(120),
  TRIVIA_QUESTION_COUNT: integerFromEnv(1, 50).default(10),
  TRIVIA_TIME_SECONDS: integerFromEnv(10, 600).default(60),
  TRIVIA_REQUIRED_SCORE: integerFromEnv(1, 50).default(10),
  TRIVIA_GRACE_SECONDS: integerFromEnv(0, 15).default(3),

  REPORT_TIMEZONE: z.string().min(1).default('America/Mexico_City'),
  REPORT_SQL_OFFSET: z.string().regex(/^[+-]\d{2}:\d{2}$/).default('-06:00'),
  BCRYPT_ROUNDS: integerFromEnv(8, 15).default(12),
  EXPORT_MAX_ROWS: integerFromEnv(100, 200000).default(50000)
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Configuración de entorno inválida:\n${issues.join('\n')}`);
}

const raw = parsed.data;

if (raw.TRIVIA_REQUIRED_SCORE > raw.TRIVIA_QUESTION_COUNT) {
  throw new Error('TRIVIA_REQUIRED_SCORE no puede ser mayor que TRIVIA_QUESTION_COUNT.');
}

if (raw.NODE_ENV === 'production' && raw.SESSION_SAME_SITE === 'none' && !raw.SESSION_SECURE) {
  throw new Error('En producción, SESSION_SAME_SITE=none requiere SESSION_SECURE=true.');
}

const config = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  port: raw.PORT,
  trustProxy: raw.TRUST_PROXY,
  appOrigins: raw.APP_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  db: Object.freeze({
    host: raw.DB_HOST,
    port: raw.DB_PORT,
    user: raw.DB_USER,
    password: raw.DB_PASSWORD,
    database: raw.DB_NAME,
    connectionLimit: raw.DB_CONNECTION_LIMIT
  }),
  session: Object.freeze({
    secret: raw.SESSION_SECRET,
    name: raw.SESSION_NAME,
    ttlHours: raw.SESSION_TTL_HOURS,
    sameSite: raw.SESSION_SAME_SITE,
    secure: raw.SESSION_SECURE
  }),
  ipHashSecret: raw.IP_HASH_SECRET,
  trivia: Object.freeze({
    tokenSecret: raw.TRIVIA_TOKEN_SECRET,
    tokenTtlMinutes: raw.TRIVIA_TOKEN_TTL_MINUTES,
    questionCount: raw.TRIVIA_QUESTION_COUNT,
    timeSeconds: raw.TRIVIA_TIME_SECONDS,
    requiredScore: raw.TRIVIA_REQUIRED_SCORE,
    graceSeconds: raw.TRIVIA_GRACE_SECONDS
  }),
  reportTimezone: raw.REPORT_TIMEZONE,
  reportSqlOffset: raw.REPORT_SQL_OFFSET,
  bcryptRounds: raw.BCRYPT_ROUNDS,
  exportMaxRows: raw.EXPORT_MAX_ROWS
});

module.exports = { config };
