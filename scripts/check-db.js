const { query, pool } = require('../src/config/database');

const requiredTables = [
  'branches',
  'survey_versions',
  'survey_questions',
  'survey_question_options',
  'survey_responses',
  'survey_answers',
  'trivia_questions',
  'trivia_question_options',
  'trivia_attempts',
  'trivia_attempt_questions',
  'admin_users',
  'admin_sessions',
  'admin_audit_logs'
];

async function main() {
  const tables = await query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()`
  );
  const present = new Set(tables.map((row) => row.tableName));
  const missing = requiredTables.filter((table) => !present.has(table));

  if (missing.length > 0) {
    throw new Error(`Faltan tablas: ${missing.join(', ')}`);
  }

  const [branches] = await query('SELECT COUNT(*) AS total FROM branches WHERE is_active = 1');
  const [surveys] = await query('SELECT COUNT(*) AS total FROM survey_versions WHERE is_active = 1');
  const [questions] = await query('SELECT COUNT(*) AS total FROM trivia_questions WHERE is_active = 1');

  console.log('Base de datos lista.');
  console.log(`Sucursales activas: ${branches.total}`);
  console.log(`Encuestas activas: ${surveys.total}`);
  console.log(`Preguntas de trivia activas: ${questions.total}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
