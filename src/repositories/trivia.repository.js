const { query } = require('../config/database');

async function countActiveQuestions(executor = null) {
  const sql = 'SELECT COUNT(*) AS total FROM trivia_questions WHERE is_active = 1';
  if (executor) {
    const [rows] = await executor.execute(sql);
    return Number(rows[0].total);
  }
  const rows = await query(sql);
  return Number(rows[0].total);
}

async function findAttemptByResponseForUpdate(connection, responseId) {
  const [rows] = await connection.execute(
    `SELECT id,
            public_id AS publicId,
            survey_response_id AS surveyResponseId,
            status,
            total_questions AS totalQuestions,
            correct_answers AS correctAnswers,
            required_score AS requiredScore,
            won,
            started_at AS startedAt,
            expires_at AS expiresAt,
            completed_at AS completedAt
       FROM trivia_attempts
      WHERE survey_response_id = ?
      LIMIT 1
      FOR UPDATE`,
    [responseId]
  );
  return rows[0] || null;
}

async function findAttemptByPublicIdForUpdate(connection, publicId) {
  const [rows] = await connection.execute(
    `SELECT ta.id,
            ta.public_id AS publicId,
            ta.survey_response_id AS surveyResponseId,
            sr.public_id AS responsePublicId,
            ta.status,
            ta.total_questions AS totalQuestions,
            ta.correct_answers AS correctAnswers,
            ta.required_score AS requiredScore,
            ta.won,
            ta.started_at AS startedAt,
            ta.expires_at AS expiresAt,
            ta.completed_at AS completedAt
       FROM trivia_attempts ta
       JOIN survey_responses sr ON sr.id = ta.survey_response_id
      WHERE ta.public_id = ?
      LIMIT 1
      FOR UPDATE`,
    [publicId]
  );
  return rows[0] || null;
}

async function findAttemptByPublicId(publicId) {
  const rows = await query(
    `SELECT ta.id,
            ta.public_id AS publicId,
            ta.survey_response_id AS surveyResponseId,
            sr.public_id AS responsePublicId,
            ta.status,
            ta.total_questions AS totalQuestions,
            ta.correct_answers AS correctAnswers,
            ta.required_score AS requiredScore,
            ta.won,
            ta.started_at AS startedAt,
            ta.expires_at AS expiresAt,
            ta.completed_at AS completedAt
       FROM trivia_attempts ta
       JOIN survey_responses sr ON sr.id = ta.survey_response_id
      WHERE ta.public_id = ?
      LIMIT 1`,
    [publicId]
  );
  return rows[0] || null;
}

async function selectRandomQuestions(connection, limit) {
  const [questions] = await connection.query(
    `SELECT id, question_text AS text
       FROM trivia_questions
      WHERE is_active = 1
      ORDER BY RAND()
      LIMIT ${Number(limit)}`
  );
  return questions;
}

async function createAttempt(connection, data) {
  const [result] = await connection.execute(
    `INSERT INTO trivia_attempts
      (public_id, survey_response_id, status, total_questions, correct_answers,
       required_score, won, started_at, expires_at)
     VALUES (?, ?, 'started', ?, 0, ?, 0, UTC_TIMESTAMP(3), TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP(3)))`,
    [data.publicId, data.responseId, data.totalQuestions, data.requiredScore, data.timeSeconds]
  );
  return result.insertId;
}

async function insertAttemptQuestions(connection, attemptId, questions) {
  const placeholders = questions.map(() => '(?, ?, ?)').join(',');
  const values = [];
  questions.forEach((question, index) => values.push(attemptId, question.id, index + 1));
  await connection.execute(
    `INSERT INTO trivia_attempt_questions (attempt_id, question_id, display_order)
     VALUES ${placeholders}`,
    values
  );
}

async function getAttemptQuestions(attemptId, executor = null) {
  const sql = `
    SELECT aq.id AS attemptQuestionId,
           aq.question_id AS questionId,
           aq.display_order AS questionOrder,
           aq.selected_option_id AS selectedOptionId,
           aq.is_correct AS isCorrect,
           aq.answered_at AS answeredAt,
           q.question_text AS questionText,
           o.id AS optionId,
           o.option_text AS optionText,
           o.is_correct AS optionIsCorrect
      FROM trivia_attempt_questions aq
      JOIN trivia_questions q ON q.id = aq.question_id
      JOIN trivia_question_options o ON o.question_id = q.id
     WHERE aq.attempt_id = ?
     ORDER BY aq.display_order, o.display_order`;

  let rows;
  if (executor) {
    [rows] = await executor.execute(sql, [attemptId]);
  } else {
    rows = await query(sql, [attemptId]);
  }
  return rows;
}

async function findAttemptQuestionForUpdate(connection, attemptId, questionId, optionId) {
  const [rows] = await connection.execute(
    `SELECT aq.id AS attemptQuestionId,
            aq.selected_option_id AS selectedOptionId,
            o.id AS optionId,
            o.is_correct AS optionIsCorrect,
            correct_option.id AS correctOptionId
       FROM trivia_attempt_questions aq
       JOIN trivia_question_options o
         ON o.question_id = aq.question_id
        AND o.id = ?
       JOIN trivia_question_options correct_option
         ON correct_option.question_id = aq.question_id
        AND correct_option.is_correct = 1
      WHERE aq.attempt_id = ?
        AND aq.question_id = ?
      LIMIT 1
      FOR UPDATE`,
    [optionId, attemptId, questionId]
  );
  return rows[0] || null;
}

async function saveAnswer(connection, attemptQuestionId, optionId, isCorrect) {
  await connection.execute(
    `UPDATE trivia_attempt_questions
        SET selected_option_id = ?,
            is_correct = ?,
            answered_at = UTC_TIMESTAMP(3)
      WHERE id = ?`,
    [optionId, isCorrect ? 1 : 0, attemptQuestionId]
  );
}

async function countAttemptProgress(connection, attemptId) {
  const [rows] = await connection.execute(
    `SELECT COUNT(selected_option_id) AS answeredCount,
            COALESCE(SUM(is_correct = 1), 0) AS correctAnswers
       FROM trivia_attempt_questions
      WHERE attempt_id = ?`,
    [attemptId]
  );
  return {
    answeredCount: Number(rows[0].answeredCount),
    correctAnswers: Number(rows[0].correctAnswers)
  };
}

async function updateAttemptProgress(connection, attemptId, correctAnswers) {
  await connection.execute(
    `UPDATE trivia_attempts
        SET correct_answers = ?
      WHERE id = ?`,
    [correctAnswers, attemptId]
  );
}

async function finalizeAttempt(connection, attemptId, data) {
  await connection.execute(
    `UPDATE trivia_attempts
        SET status = ?,
            correct_answers = ?,
            won = ?,
            completed_at = UTC_TIMESTAMP(3)
      WHERE id = ?`,
    [data.status, data.correctAnswers, data.won ? 1 : 0, attemptId]
  );
}

async function expireStaleAttempts(graceSeconds) {
  return query(
    `UPDATE trivia_attempts
        SET status = 'expired',
            completed_at = COALESCE(completed_at, UTC_TIMESTAMP(3))
      WHERE status = 'started'
        AND expires_at < TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP(3))`,
    [-Number(graceSeconds)]
  );
}

module.exports = {
  countActiveQuestions,
  findAttemptByResponseForUpdate,
  findAttemptByPublicIdForUpdate,
  findAttemptByPublicId,
  selectRandomQuestions,
  createAttempt,
  insertAttemptQuestions,
  getAttemptQuestions,
  findAttemptQuestionForUpdate,
  saveAnswer,
  countAttemptProgress,
  updateAttemptProgress,
  finalizeAttempt,
  expireStaleAttempts
};
