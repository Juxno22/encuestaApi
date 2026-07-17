const { query } = require('../config/database');

function groupSurveyRows(rows) {
  if (rows.length === 0) return null;

  const version = {
    id: rows[0].surveyVersionId,
    versionCode: rows[0].versionCode,
    title: rows[0].surveyTitle,
    description: rows[0].surveyDescription,
    questions: []
  };

  const questions = new Map();
  for (const row of rows) {
    if (!questions.has(row.questionId)) {
      const question = {
        id: row.questionId,
        code: row.questionCode,
        sectionCode: row.sectionCode,
        text: row.questionText,
        type: row.questionType,
        required: Boolean(row.isRequired),
        minValue: row.questionMinValue,
        maxValue: row.questionMaxValue,
        displayOrder: row.questionOrder,
        options: []
      };
      questions.set(row.questionId, question);
      version.questions.push(question);
    }

    if (row.optionId) {
      questions.get(row.questionId).options.push({
        id: row.optionId,
        code: row.optionCode,
        text: row.optionText,
        displayOrder: row.optionOrder
      });
    }
  }

  return version;
}

async function getActiveSurvey(executor = null) {
  const sql = `
    SELECT sv.id AS surveyVersionId,
           sv.version_code AS versionCode,
           sv.title AS surveyTitle,
           sv.description AS surveyDescription,
           q.id AS questionId,
           q.code AS questionCode,
           q.section_code AS sectionCode,
           q.question_text AS questionText,
           q.question_type AS questionType,
           q.is_required AS isRequired,
           q.min_value AS questionMinValue,
           q.max_value AS questionnMaxValue,
           q.display_order AS questionOrder,
           o.id AS optionId,
           o.option_code AS optionCode,
           o.option_text AS optionText,
           o.display_order AS optionOrder
      FROM (
        SELECT *
          FROM survey_versions
         WHERE is_active = 1
         ORDER BY published_at DESC, id DESC
         LIMIT 1
      ) sv
      JOIN survey_questions q
        ON q.survey_version_id = sv.id
       AND q.is_active = 1
 LEFT JOIN survey_question_options o
        ON o.question_id = q.id
       AND o.is_active = 1
     ORDER BY q.display_order, o.display_order`;

  let rows;
  if (executor) {
    [rows] = await executor.execute(sql);
  } else {
    rows = await query(sql);
  }
  return groupSurveyRows(rows);
}

async function insertCompletedResponse(connection, data) {
  const [result] = await connection.execute(
    `INSERT INTO survey_responses
      (public_id, branch_id, survey_version_id, customer_name, customer_email,
       customer_phone, contact_consent, privacy_notice_accepted_at, source, status,
       started_at, completed_at, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), ?, 'completed', ?, UTC_TIMESTAMP(3), ?, ?)`,
    [
      data.publicId,
      data.branchId,
      data.surveyVersionId,
      data.customerName,
      data.customerEmail,
      data.customerPhone,
      data.contactConsent ? 1 : 0,
      data.source,
      data.startedAt,
      data.ipHash,
      data.userAgent
    ]
  );
  return result.insertId;
}

async function insertAnswers(connection, responseId, answers) {
  if (answers.length === 0) return;

  const placeholders = answers.map(() => '(?, ?, ?, ?, ?)').join(',');
  const values = [];
  for (const answer of answers) {
    values.push(
      responseId,
      answer.questionId,
      answer.optionId,
      answer.numericValue,
      answer.textValue
    );
  }

  await connection.execute(
    `INSERT INTO survey_answers
      (response_id, question_id, option_id, numeric_value, text_value)
     VALUES ${placeholders}`,
    values
  );
}

async function getCompletedResponseForUpdate(connection, publicId) {
  const [rows] = await connection.execute(
    `SELECT r.id,
            r.public_id AS publicId,
            r.branch_id AS branchId,
            r.status,
            r.completed_at AS completedAt
       FROM survey_responses r
      WHERE r.public_id = ?
      LIMIT 1
      FOR UPDATE`,
    [publicId]
  );
  return rows[0] || null;
}

async function getCompletedResponse(publicId) {
  const rows = await query(
    `SELECT r.id,
            r.public_id AS publicId,
            r.branch_id AS branchId,
            r.status,
            r.completed_at AS completedAt
       FROM survey_responses r
      WHERE r.public_id = ?
      LIMIT 1`,
    [publicId]
  );
  return rows[0] || null;
}

module.exports = {
  getActiveSurvey,
  insertCompletedResponse,
  insertAnswers,
  getCompletedResponseForUpdate,
  getCompletedResponse
};
