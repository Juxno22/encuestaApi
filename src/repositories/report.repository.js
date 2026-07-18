const { query } = require("../config/database");
const { config } = require("../config/env");

function buildResponseWhere(filters = {}, options = {}) {
  const conditions = ["r.status = 'completed'"];
  const params = [];

  if (filters.fromUtc) {
    conditions.push("r.completed_at >= ?");
    params.push(filters.fromUtc);
  }
  if (filters.toUtc) {
    conditions.push("r.completed_at <= ?");
    params.push(filters.toUtc);
  }
  if (filters.branchId) {
    conditions.push("r.branch_id = ?");
    params.push(filters.branchId);
  }
  if (options.search && filters.search) {
    conditions.push(`(
      r.public_id LIKE ? OR
      r.customer_name LIKE ? OR
      r.customer_email LIKE ? OR
      r.customer_phone LIKE ?
    )`);
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }
  if (options.trivia && filters.trivia && filters.trivia !== "all") {
    const triviaConditions = {
      not_played: "ta.id IS NULL",
      played: "ta.id IS NOT NULL",
      won: "ta.won = 1",
      lost: "ta.id IS NOT NULL AND ta.won = 0 AND ta.status IN ('completed', 'expired')",
    };
    conditions.push(triviaConditions[filters.trivia]);
  }

  return {
    clause: conditions.join(" AND "),
    params,
  };
}

async function getSummary(filters) {
  const where = buildResponseWhere(filters);
  const rows = await query(
    `SELECT COUNT(*) AS totalResponses,
            COUNT(DISTINCT branchId) AS activeBranches,
            ROUND(AVG(recommendationScore), 2) AS averageRecommendation,
            ROUND(AVG(staffAttention), 2) AS averageStaffAttention,
            ROUND(AVG(purchaseEase), 2) AS averagePurchaseEase,
            ROUND(AVG(salesAdvice), 2) AS averageSalesAdvice,
            ROUND(AVG(valueForMoney), 2) AS averageValueForMoney,
            ROUND(AVG(cleanliness), 2) AS averageCleanliness,
            ROUND(AVG(orderPresentation), 2) AS averageOrderPresentation,
            ROUND(AVG(
              (staffAttention + purchaseEase + salesAdvice + valueForMoney + cleanliness + orderPresentation) / 6
            ), 2) AS overallServiceAverage,
            ROUND(
              100 * (
                SUM(recommendationScore >= 9) / NULLIF(COUNT(recommendationScore), 0) -
                SUM(recommendationScore <= 6) / NULLIF(COUNT(recommendationScore), 0)
              ),
              1
            ) AS nps
       FROM (
         SELECT r.id,
                r.branch_id AS branchId,
                MAX(CASE WHEN q.code = 'RECOMMENDATION_SCORE' THEN a.numeric_value END) AS recommendationScore,
                MAX(CASE WHEN q.code = 'STAFF_ATTENTION' THEN a.numeric_value END) AS staffAttention,
                MAX(CASE WHEN q.code = 'PURCHASE_EASE' THEN a.numeric_value END) AS purchaseEase,
                MAX(CASE WHEN q.code = 'SALES_ADVICE' THEN a.numeric_value END) AS salesAdvice,
                MAX(CASE WHEN q.code = 'VALUE_FOR_MONEY' THEN a.numeric_value END) AS valueForMoney,
                MAX(CASE WHEN q.code = 'CLEANLINESS' THEN a.numeric_value END) AS cleanliness,
                MAX(CASE WHEN q.code = 'ORDER_PRESENTATION' THEN a.numeric_value END) AS orderPresentation
           FROM survey_responses r
      LEFT JOIN survey_answers a ON a.response_id = r.id
      LEFT JOIN survey_questions q ON q.id = a.question_id
          WHERE ${where.clause}
          GROUP BY r.id, r.branch_id
       ) responseMetrics`,
    where.params,
  );
  return rows[0];
}

async function getTrend(filters) {
  const where = buildResponseWhere(filters);
  return query(
    `SELECT
       DATE(
         CONVERT_TZ(
           r.completed_at,
           '+00:00',
           ?
         )
       ) AS responseDate,
       COUNT(
         DISTINCT r.id
       ) AS totalResponses,
       ROUND(
         AVG(
           CASE
             WHEN q.code = 'RECOMMENDATION_SCORE'
             THEN a.numeric_value
           END
         ),
         2
       ) AS averageRecommendation,
       ROUND(
         AVG(
           CASE
             WHEN q.code = 'STAFF_ATTENTION'
             THEN a.numeric_value
           END
         ),
         2
       ) AS averageStaffAttention
     FROM survey_responses r
     LEFT JOIN survey_answers a
       ON a.response_id = r.id
     LEFT JOIN survey_questions q
       ON q.id = a.question_id
     WHERE ${where.clause}
     GROUP BY responseDate
     ORDER BY responseDate ASC`,
    [config.reportSqlOffset, ...where.params],
  );
}

async function getBranchPerformance(filters) {
  const where = buildResponseWhere(filters);
  return query(
    `SELECT b.id AS branchId,
            b.administrative_name AS administrativeName,
            b.public_name AS publicName,
            COUNT(DISTINCT r.id) AS totalResponses,
            ROUND(AVG(CASE WHEN q.code = 'RECOMMENDATION_SCORE' THEN a.numeric_value END), 2) AS averageRecommendation,
            ROUND(AVG(CASE WHEN q.code = 'STAFF_ATTENTION' THEN a.numeric_value END), 2) AS averageStaffAttention,
            ROUND(AVG(CASE WHEN q.code = 'PURCHASE_EASE' THEN a.numeric_value END), 2) AS averagePurchaseEase,
            ROUND(AVG(CASE WHEN q.code = 'SALES_ADVICE' THEN a.numeric_value END), 2) AS averageSalesAdvice,
            ROUND(AVG(CASE WHEN q.code = 'VALUE_FOR_MONEY' THEN a.numeric_value END), 2) AS averageValueForMoney,
            ROUND(AVG(CASE WHEN q.code = 'CLEANLINESS' THEN a.numeric_value END), 2) AS averageCleanliness,
            ROUND(AVG(CASE WHEN q.code = 'ORDER_PRESENTATION' THEN a.numeric_value END), 2) AS averageOrderPresentation
       FROM survey_responses r
       JOIN branches b ON b.id = r.branch_id
  LEFT JOIN survey_answers a ON a.response_id = r.id
  LEFT JOIN survey_questions q ON q.id = a.question_id
      WHERE ${where.clause}
      GROUP BY b.id, b.administrative_name, b.public_name
      ORDER BY totalResponses DESC, b.public_name ASC`,
    where.params,
  );
}

async function getQuestionDistributions(filters) {
  const where = buildResponseWhere(filters);
  return query(
    `SELECT
       q.id AS questionId,
       q.code AS questionCode,
       q.question_text AS questionText,
       q.question_type AS questionType,
       q.display_order AS displayOrder,
       a.numeric_value AS numericValue,
       o.option_code AS optionCode,
       o.option_text AS optionText,
       MIN(o.display_order) AS optionDisplayOrder,
       COUNT(*) AS total
     FROM survey_responses r
     JOIN survey_answers a
       ON a.response_id = r.id
     JOIN survey_questions q
       ON q.id = a.question_id
     LEFT JOIN survey_question_options o
       ON o.id = a.option_id
     WHERE ${where.clause}
       AND q.question_type IN (
         'rating',
         'single_choice'
       )
     GROUP BY
       q.id,
       q.code,
       q.question_text,
       q.question_type,
       q.display_order,
       a.numeric_value,
       o.option_code,
       o.option_text
     ORDER BY
       q.display_order,
       a.numeric_value,
       optionDisplayOrder`,
    where.params,
  );
}

async function getRecentOpenAnswers(filters, limit = 50) {
  const where = buildResponseWhere(filters);
  return query(
    `SELECT r.public_id AS responsePublicId,
            r.completed_at AS completedAt,
            b.public_name AS branchPublicName,
            q.code AS questionCode,
            q.question_text AS questionText,
            a.text_value AS answerText
       FROM survey_responses r
       JOIN branches b ON b.id = r.branch_id
       JOIN survey_answers a ON a.response_id = r.id
       JOIN survey_questions q ON q.id = a.question_id
      WHERE ${where.clause}
        AND q.question_type = 'long_text'
        AND NULLIF(TRIM(a.text_value), '') IS NOT NULL
      ORDER BY r.completed_at DESC
      LIMIT ${Number(limit)}`,
    where.params,
  );
}

async function getTriviaStats(filters) {
  const where = buildResponseWhere(filters);
  const rows = await query(
    `SELECT COUNT(DISTINCT r.id) AS eligibleResponses,
            COUNT(DISTINCT ta.id) AS triviaAttempts,
            COALESCE(SUM(ta.status IN ('completed', 'expired')), 0) AS finishedAttempts,
            COALESCE(SUM(ta.won = 1), 0) AS winners,
            ROUND(AVG(ta.correct_answers), 2) AS averageScore
       FROM survey_responses r
  LEFT JOIN trivia_attempts ta ON ta.survey_response_id = r.id
      WHERE ${where.clause}`,
    where.params,
  );
  return rows[0];
}

async function countResponses(filters) {
  const where = buildResponseWhere(filters, { search: true, trivia: true });
  const rows = await query(
    `SELECT COUNT(*) AS total
       FROM survey_responses r
  LEFT JOIN trivia_attempts ta ON ta.survey_response_id = r.id
      WHERE ${where.clause}`,
    where.params,
  );
  return Number(rows[0].total);
}

async function listResponses(filters) {
  const where = buildResponseWhere(filters, { search: true, trivia: true });
  const offset = (filters.page - 1) * filters.limit;
  return query(
    `SELECT v.public_id AS publicId,
            v.branch_administrative_name AS branchAdministrativeName,
            v.branch_public_name AS branchPublicName,
            v.customer_name AS customerName,
            v.customer_email AS customerEmail,
            v.customer_phone AS customerPhone,
            v.contact_consent AS contactConsent,
            v.source,
            v.started_at AS startedAt,
            v.completed_at AS completedAt,
            v.duration_seconds AS durationSeconds,
            v.recommendation_score AS recommendationScore,
            v.staff_attention AS staffAttention,
            v.found_product AS foundProduct,
            v.service_time AS serviceTime,
            v.played_trivia AS playedTrivia,
            v.trivia_status AS triviaStatus,
            v.trivia_score AS triviaScore,
            v.trivia_won AS triviaWon
       FROM vw_survey_export v
       JOIN survey_responses r ON r.id = v.response_id
  LEFT JOIN trivia_attempts ta ON ta.survey_response_id = r.id
      WHERE ${where.clause}
      ORDER BY r.completed_at DESC, r.id DESC
      LIMIT ${Number(filters.limit)} OFFSET ${Number(offset)}`,
    where.params,
  );
}

async function getResponseDetail(publicId) {
  const responseRows = await query(
    `SELECT r.id,
            r.public_id AS publicId,
            r.customer_name AS customerName,
            r.customer_email AS customerEmail,
            r.customer_phone AS customerPhone,
            r.contact_consent AS contactConsent,
            r.source,
            r.started_at AS startedAt,
            r.completed_at AS completedAt,
            TIMESTAMPDIFF(SECOND, r.started_at, r.completed_at) AS durationSeconds,
            b.id AS branchId,
            b.administrative_name AS branchAdministrativeName,
            b.public_name AS branchPublicName,
            sv.version_code AS surveyVersion,
            ta.public_id AS triviaAttemptPublicId,
            ta.status AS triviaStatus,
            ta.correct_answers AS triviaScore,
            ta.total_questions AS triviaTotalQuestions,
            ta.won AS triviaWon,
            ta.started_at AS triviaStartedAt,
            ta.completed_at AS triviaCompletedAt
       FROM survey_responses r
       JOIN branches b ON b.id = r.branch_id
       JOIN survey_versions sv ON sv.id = r.survey_version_id
  LEFT JOIN trivia_attempts ta ON ta.survey_response_id = r.id
      WHERE r.public_id = ?
      LIMIT 1`,
    [publicId],
  );

  if (responseRows.length === 0) return null;

  const answers = await query(
    `SELECT q.code AS questionCode,
            q.question_text AS questionText,
            q.question_type AS questionType,
            q.display_order AS displayOrder,
            a.numeric_value AS numericValue,
            o.option_code AS optionCode,
            o.option_text AS optionText,
            a.text_value AS textValue
       FROM survey_answers a
       JOIN survey_questions q ON q.id = a.question_id
  LEFT JOIN survey_question_options o ON o.id = a.option_id
       JOIN survey_responses r ON r.id = a.response_id
      WHERE r.public_id = ?
      ORDER BY q.display_order`,
    [publicId],
  );

  return { ...responseRows[0], answers };
}

async function countExportRows(filters) {
  return countResponses({ ...filters, page: 1, limit: 1 });
}

async function exportResponses(filters, maxRows) {
  const where = buildResponseWhere(filters, { search: true, trivia: true });
  return query(
    `SELECT v.public_id AS publicId,
            v.branch_administrative_name AS branchAdministrativeName,
            v.branch_public_name AS branchPublicName,
            v.customer_name AS customerName,
            v.customer_email AS customerEmail,
            v.customer_phone AS customerPhone,
            v.contact_consent AS contactConsent,
            v.source,
            v.started_at AS startedAt,
            v.completed_at AS completedAt,
            v.duration_seconds AS durationSeconds,
            v.recommendation_score AS recommendationScore,
            v.staff_attention AS staffAttention,
            v.found_product AS foundProduct,
            v.service_time AS serviceTime,
            v.purchase_ease AS purchaseEase,
            v.sales_advice AS salesAdvice,
            v.value_for_money AS valueForMoney,
            v.cleanliness,
            v.order_presentation AS orderPresentation,
            v.desired_product AS desiredProduct,
            v.comments,
            v.played_trivia AS playedTrivia,
            v.trivia_status AS triviaStatus,
            v.trivia_score AS triviaScore,
            v.trivia_won AS triviaWon
       FROM vw_survey_export v
       JOIN survey_responses r ON r.id = v.response_id
  LEFT JOIN trivia_attempts ta ON ta.survey_response_id = r.id
      WHERE ${where.clause}
      ORDER BY r.completed_at DESC, r.id DESC
      LIMIT ${Number(maxRows)}`,
    where.params,
  );
}

module.exports = {
  getSummary,
  getTrend,
  getBranchPerformance,
  getQuestionDistributions,
  getRecentOpenAnswers,
  getTriviaStats,
  countResponses,
  listResponses,
  getResponseDetail,
  countExportRows,
  exportResponses,
};
