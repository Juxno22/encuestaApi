const reportRepository = require('../repositories/report.repository');
const branchRepository = require('../repositories/branch.repository');
const surveyRepository = require('../repositories/survey.repository');
const { config } = require('../config/env');
const { normalizeDateFilters } = require('../utils/dates');
const { createPagination } = require('../utils/pagination');
const { NotFoundError, ValidationError } = require('../utils/app-error');
const { toCsv } = require('../utils/csv');

function normalizeFilters(rawFilters) {
  return {
    ...rawFilters,
    ...normalizeDateFilters(rawFilters)
  };
}

function numberOrZero(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

async function getDashboardSummary(rawFilters) {
  const filters = normalizeFilters(rawFilters);
  const [summary, trivia] = await Promise.all([
    reportRepository.getSummary(filters),
    reportRepository.getTriviaStats(filters)
  ]);

  const attempts = numberOrZero(trivia.triviaAttempts);
  const eligible = numberOrZero(trivia.eligibleResponses);
  const winners = numberOrZero(trivia.winners);

  return {
    filters: rawFilters,
    survey: {
      totalResponses: numberOrZero(summary.totalResponses),
      activeBranches: numberOrZero(summary.activeBranches),
      nps: summary.nps === null ? null : Number(summary.nps),
      averages: {
        recommendation: summary.averageRecommendation,
        staffAttention: summary.averageStaffAttention,
        purchaseEase: summary.averagePurchaseEase,
        salesAdvice: summary.averageSalesAdvice,
        valueForMoney: summary.averageValueForMoney,
        cleanliness: summary.averageCleanliness,
        orderPresentation: summary.averageOrderPresentation,
        overallService: summary.overallServiceAverage
      }
    },
    trivia: {
      eligibleResponses: eligible,
      attempts,
      finishedAttempts: numberOrZero(trivia.finishedAttempts),
      winners,
      averageScore: trivia.averageScore === null ? null : Number(trivia.averageScore),
      participationRate: eligible === 0 ? 0 : Number(((attempts / eligible) * 100).toFixed(1)),
      winRate: attempts === 0 ? 0 : Number(((winners / attempts) * 100).toFixed(1))
    }
  };
}

async function getTrend(rawFilters) {
  const filters = normalizeFilters(rawFilters);
  return reportRepository.getTrend(filters);
}

async function getBranchPerformance(rawFilters) {
  const filters = normalizeFilters(rawFilters);
  return reportRepository.getBranchPerformance(filters);
}

async function getQuestionAnalytics(rawFilters) {
  const filters = normalizeFilters(rawFilters);
  const [rows, recentOpenAnswers] = await Promise.all([
    reportRepository.getQuestionDistributions(filters),
    reportRepository.getRecentOpenAnswers(filters, 50)
  ]);

  const questions = new Map();
  for (const row of rows) {
    if (!questions.has(row.questionId)) {
      questions.set(row.questionId, {
        questionId: row.questionId,
        code: row.questionCode,
        text: row.questionText,
        type: row.questionType,
        displayOrder: row.displayOrder,
        totalAnswers: 0,
        average: null,
        distribution: []
      });
    }

    const question = questions.get(row.questionId);
    const total = Number(row.total);
    question.totalAnswers += total;
    question.distribution.push({
      value: row.questionType === 'rating' ? Number(row.numericValue) : row.optionCode,
      label: row.questionType === 'rating' ? String(row.numericValue) : row.optionText,
      total
    });
  }

  for (const question of questions.values()) {
    if (question.type === 'rating' && question.totalAnswers > 0) {
      const weighted = question.distribution.reduce(
        (sum, item) => sum + Number(item.value) * item.total,
        0
      );
      question.average = Number((weighted / question.totalAnswers).toFixed(2));
    }
  }

  return {
    questions: [...questions.values()].sort((a, b) => a.displayOrder - b.displayOrder),
    recentOpenAnswers
  };
}

async function listResponses(rawFilters) {
  const filters = normalizeFilters(rawFilters);
  const [total, items] = await Promise.all([
    reportRepository.countResponses(filters),
    reportRepository.listResponses(filters)
  ]);

  return {
    items,
    pagination: createPagination(filters.page, filters.limit, total)
  };
}

async function getResponseDetail(publicId) {
  const response = await reportRepository.getResponseDetail(publicId);
  if (!response) throw new NotFoundError('No se encontró la respuesta solicitada.');

  return {
    ...response,
    contactConsent: Boolean(response.contactConsent),
    triviaWon: response.triviaWon === null ? null : Boolean(response.triviaWon),
    answers: response.answers.map((answer) => ({
      ...answer,
      value: answer.questionType === 'rating'
        ? answer.numericValue
        : answer.questionType === 'single_choice'
          ? answer.optionText
          : answer.textValue
    }))
  };
}

async function getAdminMetadata() {
  const [branches, survey] = await Promise.all([
    branchRepository.listAdminBranches(),
    surveyRepository.getActiveSurvey()
  ]);

  return {
    branches,
    survey: survey
      ? {
          versionCode: survey.versionCode,
          title: survey.title,
          questions: survey.questions.map((question) => ({
            code: question.code,
            text: question.text,
            type: question.type,
            displayOrder: question.displayOrder
          }))
        }
      : null,
    reportTimezone: config.reportTimezone
  };
}

async function exportResponsesCsv(rawFilters) {
  const filters = normalizeFilters(rawFilters);
  const total = await reportRepository.countExportRows(filters);
  if (total > config.exportMaxRows) {
    throw new ValidationError(
      `La exportación contiene ${total} registros. Reduce el rango a un máximo de ${config.exportMaxRows}.`
    );
  }

  const rows = await reportRepository.exportResponses(filters, config.exportMaxRows);
  const headers = [
    { key: 'publicId', label: 'ID público' },
    { key: 'branchAdministrativeName', label: 'Sucursal administrativa' },
    { key: 'branchPublicName', label: 'Sucursal pública' },
    { key: 'customerName', label: 'Nombre' },
    { key: 'customerEmail', label: 'Correo' },
    { key: 'customerPhone', label: 'Teléfono' },
    { key: 'contactConsent', label: 'Acepta contacto' },
    { key: 'source', label: 'Origen' },
    { key: 'startedAt', label: 'Inicio' },
    { key: 'completedAt', label: 'Finalización' },
    { key: 'durationSeconds', label: 'Duración (segundos)' },
    { key: 'recommendationScore', label: 'Recomendación' },
    { key: 'staffAttention', label: 'Atención del personal' },
    { key: 'foundProduct', label: 'Encontró producto/servicio' },
    { key: 'serviceTime', label: 'Tiempo de atención' },
    { key: 'purchaseEase', label: 'Facilidad de compra/pago' },
    { key: 'salesAdvice', label: 'Conocimiento y asesoría' },
    { key: 'valueForMoney', label: 'Calidad-precio' },
    { key: 'cleanliness', label: 'Limpieza' },
    { key: 'orderPresentation', label: 'Orden y presentación' },
    { key: 'desiredProduct', label: 'Producto o servicio solicitado' },
    { key: 'comments', label: 'Comentarios' },
    { key: 'playedTrivia', label: 'Jugó trivia' },
    { key: 'triviaStatus', label: 'Estado trivia' },
    { key: 'triviaScore', label: 'Puntaje trivia' },
    { key: 'triviaWon', label: 'Ganó trivia' }
  ];

  return {
    total,
    content: toCsv(headers, rows),
    filename: `diagsa-encuestas-${new Date().toISOString().slice(0, 10)}.csv`
  };
}

module.exports = {
  getDashboardSummary,
  getTrend,
  getBranchPerformance,
  getQuestionAnalytics,
  listResponses,
  getResponseDetail,
  getAdminMetadata,
  exportResponsesCsv,
  normalizeFilters
};
