const branchRepository = require('../repositories/branch.repository');
const surveyRepository = require('../repositories/survey.repository');
const triviaRepository = require('../repositories/trivia.repository');
const { withTransaction } = require('../config/database');
const { config } = require('../config/env');
const { ValidationError, NotFoundError } = require('../utils/app-error');
const { createOpaqueId, hashIp } = require('../utils/crypto');
const { createTriviaAccessToken } = require('../utils/tokens');
const { normalizeSurveyStartedAt } = require('../utils/dates');

function publicQuestion(question) {
  return {
    code: question.code,
    sectionCode: question.sectionCode,
    text: question.text,
    type: question.type,
    required: question.required,
    minValue: question.minValue,
    maxValue: question.maxValue,
    displayOrder: question.displayOrder,
    options: question.options.map((option) => ({
      code: option.code,
      text: option.text,
      displayOrder: option.displayOrder
    }))
  };
}

async function listBranches() {
  return branchRepository.listPublicBranches();
}

async function resolveBranch(reference) {
  const branch = await branchRepository.resolveActiveBranch(reference);
  if (!branch) throw new NotFoundError('La sucursal no existe o está inactiva.');
  return branch;
}

async function getPublicSurvey() {
  const survey = await surveyRepository.getActiveSurvey();
  if (!survey) throw new NotFoundError('No hay una encuesta activa en este momento.');

  return {
    versionCode: survey.versionCode,
    title: survey.title,
    description: survey.description,
    privacyNoticeRequired: true,
    questions: survey.questions.map(publicQuestion)
  };
}

function normalizeCustomer(customer) {
  const name = customer.name?.trim() || null;
  const email = customer.email?.trim().toLowerCase() || null;
  const phone = customer.phone?.trim() || null;
  const hasContactData = Boolean(name || email || phone);

  return {
    name,
    email,
    phone,
    contactConsent: hasContactData ? Boolean(customer.contactConsent) : false
  };
}

function validateAndNormalizeAnswers(survey, rawAnswers) {
  const knownCodes = new Set(survey.questions.map((question) => question.code));
  const unknownCodes = Object.keys(rawAnswers).filter((code) => !knownCodes.has(code));
  if (unknownCodes.length > 0) {
    throw new ValidationError('La encuesta contiene respuestas para preguntas desconocidas.', {
      unknownQuestionCodes: unknownCodes
    });
  }

  const normalized = [];
  const errors = [];

  for (const question of survey.questions) {
    const rawValue = rawAnswers[question.code];
    const missing = rawValue === undefined || rawValue === null || rawValue === '';

    if (missing) {
      if (question.required) {
        errors.push({ questionCode: question.code, message: 'La respuesta es obligatoria.' });
      }
      continue;
    }

    if (question.type === 'rating') {
      const number = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isInteger(number) || number < question.minValue || number > question.maxValue) {
        errors.push({
          questionCode: question.code,
          message: `La calificación debe ser un entero entre ${question.minValue} y ${question.maxValue}.`
        });
        continue;
      }
      normalized.push({
        questionId: question.id,
        optionId: null,
        numericValue: number,
        textValue: null
      });
      continue;
    }

    if (question.type === 'single_choice') {
      if (typeof rawValue !== 'string') {
        errors.push({ questionCode: question.code, message: 'Selecciona una opción válida.' });
        continue;
      }
      const option = question.options.find((item) => item.code === rawValue);
      if (!option) {
        errors.push({ questionCode: question.code, message: 'La opción seleccionada no existe.' });
        continue;
      }
      normalized.push({
        questionId: question.id,
        optionId: option.id,
        numericValue: null,
        textValue: null
      });
      continue;
    }

    if (question.type === 'long_text') {
      if (typeof rawValue !== 'string' || rawValue.trim().length > 5000) {
        errors.push({ questionCode: question.code, message: 'El comentario no es válido.' });
        continue;
      }
      const text = rawValue.trim();
      if (text) {
        normalized.push({
          questionId: question.id,
          optionId: null,
          numericValue: null,
          textValue: text
        });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Faltan respuestas o existen valores inválidos.', errors);
  }

  return normalized;
}

async function submitSurvey(payload, requestContext) {
  const result = await withTransaction(async (connection) => {
    const branch = await branchRepository.resolveActiveBranch(payload.branch, connection, true);
    if (!branch) throw new NotFoundError('La sucursal no existe o está inactiva.');

    const survey = await surveyRepository.getActiveSurvey(connection);
    if (!survey) throw new NotFoundError('No hay una encuesta activa en este momento.');

    const answers = validateAndNormalizeAnswers(survey, payload.answers);
    const customer = normalizeCustomer(payload.customer);
    const responsePublicId = createOpaqueId();

    const responseId = await surveyRepository.insertCompletedResponse(connection, {
      publicId: responsePublicId,
      branchId: branch.id,
      surveyVersionId: survey.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      contactConsent: customer.contactConsent,
      source: payload.branch.token ? 'qr' : payload.source,
      startedAt: normalizeSurveyStartedAt(payload.startedAt),
      ipHash: hashIp(requestContext.ip),
      userAgent: requestContext.userAgent?.slice(0, 500) || null
    });

    await surveyRepository.insertAnswers(connection, responseId, answers);
    const activeTriviaQuestions = await triviaRepository.countActiveQuestions(connection);

    return {
      responsePublicId,
      branch,
      survey,
      triviaAvailable: activeTriviaQuestions >= config.trivia.questionCount
    };
  });

  return {
    responsePublicId: result.responsePublicId,
    completed: true,
    branch: {
      slug: result.branch.slug,
      publicName: result.branch.publicName
    },
    surveyVersion: result.survey.versionCode,
    triviaAvailable: result.triviaAvailable,
    triviaAccessToken: result.triviaAvailable
      ? createTriviaAccessToken(result.responsePublicId)
      : null
  };
}

module.exports = {
  listBranches,
  resolveBranch,
  getPublicSurvey,
  submitSurvey,
  validateAndNormalizeAnswers
};
