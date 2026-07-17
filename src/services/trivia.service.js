const { withTransaction } = require('../config/database');
const { config } = require('../config/env');
const surveyRepository = require('../repositories/survey.repository');
const triviaRepository = require('../repositories/trivia.repository');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  GoneError,
  ForbiddenError
} = require('../utils/app-error');
const { createOpaqueId } = require('../utils/crypto');
const { stableShuffle } = require('../utils/shuffle');

function assertTokenSubject(tokenPayload, responsePublicId) {
  if (tokenPayload.sub !== responsePublicId) {
    throw new ForbiddenError('El acceso no corresponde a esta encuesta.');
  }
}

function isAttemptExpired(attempt) {
  const expiresAt = new Date(attempt.expiresAt).getTime();
  return Date.now() > expiresAt + config.trivia.graceSeconds * 1000;
}

function remainingSeconds(attempt) {
  const milliseconds = new Date(attempt.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(milliseconds / 1000));
}

function buildQuestions(rows, attemptPublicId) {
  const questions = new Map();

  for (const row of rows) {
    if (!questions.has(row.questionId)) {
      questions.set(row.questionId, {
        id: row.questionId,
        order: row.questionOrder,
        text: row.questionText,
        selectedOptionId: row.selectedOptionId,
        isCorrect: row.isCorrect === null ? null : Boolean(row.isCorrect),
        correctOptionId: row.selectedOptionId ? null : undefined,
        options: []
      });
    }

    const question = questions.get(row.questionId);
    question.options.push({ id: row.optionId, text: row.optionText });
    if (row.selectedOptionId && row.optionIsCorrect) {
      question.correctOptionId = row.optionId;
    }
  }

  return [...questions.values()]
    .sort((left, right) => left.order - right.order)
    .map((question) => ({
      ...question,
      options: stableShuffle(question.options, `${attemptPublicId}:${question.id}`)
    }));
}

function resultFromAttempt(attempt) {
  return {
    attemptPublicId: attempt.publicId,
    status: attempt.status,
    score: Number(attempt.correctAnswers),
    totalQuestions: Number(attempt.totalQuestions),
    requiredScore: Number(attempt.requiredScore),
    won: Boolean(attempt.won),
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt
  };
}

async function startTrivia(responsePublicId, tokenPayload) {
  assertTokenSubject(tokenPayload, responsePublicId);

  const attempt = await withTransaction(async (connection) => {
    const response = await surveyRepository.getCompletedResponseForUpdate(connection, responsePublicId);
    if (!response) throw new NotFoundError('No se encontró la encuesta respondida.');
    if (response.status !== 'completed') {
      throw new ValidationError('La encuesta debe estar completa antes de iniciar la trivia.');
    }

    const existing = await triviaRepository.findAttemptByResponseForUpdate(connection, response.id);
    if (existing) {
      throw new ConflictError('Esta encuesta ya utilizó su intento de trivia.', {
        attemptPublicId: existing.publicId,
        status: existing.status
      });
    }

    const questions = await triviaRepository.selectRandomQuestions(connection, config.trivia.questionCount);
    if (questions.length < config.trivia.questionCount) {
      throw new ValidationError('No existen suficientes preguntas activas para iniciar la trivia.');
    }

    const attemptPublicId = createOpaqueId();
    const attemptId = await triviaRepository.createAttempt(connection, {
      publicId: attemptPublicId,
      responseId: response.id,
      totalQuestions: config.trivia.questionCount,
      requiredScore: config.trivia.requiredScore,
      timeSeconds: config.trivia.timeSeconds
    });
    await triviaRepository.insertAttemptQuestions(connection, attemptId, questions);

    return triviaRepository.findAttemptByPublicIdForUpdate(connection, attemptPublicId);
  });

  const rows = await triviaRepository.getAttemptQuestions(attempt.id);
  return {
    attemptPublicId: attempt.publicId,
    status: attempt.status,
    durationSeconds: config.trivia.timeSeconds,
    remainingSeconds: remainingSeconds(attempt),
    expiresAt: attempt.expiresAt,
    totalQuestions: attempt.totalQuestions,
    requiredScore: attempt.requiredScore,
    questions: buildQuestions(rows, attempt.publicId).map((question) => ({
      id: question.id,
      order: question.order,
      text: question.text,
      options: question.options
    }))
  };
}

async function getTriviaAvailability(responsePublicId, tokenPayload) {
  assertTokenSubject(tokenPayload, responsePublicId);

  return withTransaction(async (connection) => {
    const response = await surveyRepository.getCompletedResponseForUpdate(connection, responsePublicId);
    if (!response) throw new NotFoundError('No se encontró la encuesta respondida.');

    const attempt = await triviaRepository.findAttemptByResponseForUpdate(connection, response.id);
    if (!attempt) return { available: true, used: false };

    if (attempt.status === 'started' && isAttemptExpired(attempt)) {
      await triviaRepository.finalizeAttempt(connection, attempt.id, {
        status: 'expired',
        correctAnswers: Number(attempt.correctAnswers),
        won: false
      });
      attempt.status = 'expired';
      attempt.won = 0;
      attempt.completedAt = new Date();
    }

    return {
      available: false,
      used: true,
      attempt: resultFromAttempt(attempt)
    };
  });
}

async function answerQuestion(attemptPublicId, payload, tokenPayload) {
  return withTransaction(async (connection) => {
    const attempt = await triviaRepository.findAttemptByPublicIdForUpdate(connection, attemptPublicId);
    if (!attempt) throw new NotFoundError('No se encontró el intento de trivia.');
    assertTokenSubject(tokenPayload, attempt.responsePublicId);

    if (attempt.status !== 'started') {
      throw new ConflictError('La trivia ya terminó.', resultFromAttempt(attempt));
    }

    if (isAttemptExpired(attempt)) {
      const progress = await triviaRepository.countAttemptProgress(connection, attempt.id);
      await triviaRepository.finalizeAttempt(connection, attempt.id, {
        status: 'expired',
        correctAnswers: progress.correctAnswers,
        won: false
      });
      throw new GoneError('El tiempo de la trivia terminó.', {
        status: 'expired',
        score: progress.correctAnswers,
        totalQuestions: attempt.totalQuestions,
        won: false
      });
    }

    const attemptQuestion = await triviaRepository.findAttemptQuestionForUpdate(
      connection,
      attempt.id,
      payload.questionId,
      payload.optionId
    );

    if (!attemptQuestion) {
      throw new ValidationError('La pregunta u opción no pertenece a este intento.');
    }
    if (attemptQuestion.selectedOptionId) {
      throw new ConflictError('Esta pregunta ya fue respondida.');
    }

    const isCorrect = Boolean(attemptQuestion.optionIsCorrect);
    await triviaRepository.saveAnswer(
      connection,
      attemptQuestion.attemptQuestionId,
      payload.optionId,
      isCorrect
    );

    const progress = await triviaRepository.countAttemptProgress(connection, attempt.id);
    await triviaRepository.updateAttemptProgress(connection, attempt.id, progress.correctAnswers);

    const completed = progress.answeredCount >= Number(attempt.totalQuestions);
    const won = completed && progress.correctAnswers >= Number(attempt.requiredScore);

    if (completed) {
      await triviaRepository.finalizeAttempt(connection, attempt.id, {
        status: 'completed',
        correctAnswers: progress.correctAnswers,
        won
      });
    }

    return {
      accepted: true,
      questionId: payload.questionId,
      selectedOptionId: payload.optionId,
      isCorrect,
      correctOptionId: attemptQuestion.correctOptionId,
      answeredCount: progress.answeredCount,
      remainingQuestions: Number(attempt.totalQuestions) - progress.answeredCount,
      completed,
      remainingSeconds: completed ? 0 : remainingSeconds(attempt),
      result: completed
        ? {
            attemptPublicId,
            status: 'completed',
            score: progress.correctAnswers,
            totalQuestions: Number(attempt.totalQuestions),
            requiredScore: Number(attempt.requiredScore),
            won
          }
        : null
    };
  });
}

async function finishTrivia(attemptPublicId, tokenPayload) {
  return withTransaction(async (connection) => {
    const attempt = await triviaRepository.findAttemptByPublicIdForUpdate(connection, attemptPublicId);
    if (!attempt) throw new NotFoundError('No se encontró el intento de trivia.');
    assertTokenSubject(tokenPayload, attempt.responsePublicId);

    if (attempt.status !== 'started') return resultFromAttempt(attempt);

    const progress = await triviaRepository.countAttemptProgress(connection, attempt.id);
    const expired = isAttemptExpired(attempt);
    const status = expired ? 'expired' : 'completed';
    const won = !expired && progress.correctAnswers >= Number(attempt.requiredScore);

    await triviaRepository.finalizeAttempt(connection, attempt.id, {
      status,
      correctAnswers: progress.correctAnswers,
      won
    });

    return {
      attemptPublicId: attempt.publicId,
      status,
      score: progress.correctAnswers,
      totalQuestions: Number(attempt.totalQuestions),
      requiredScore: Number(attempt.requiredScore),
      won,
      answeredCount: progress.answeredCount
    };
  });
}

async function getAttemptStatus(attemptPublicId, tokenPayload) {
  const attempt = await withTransaction(async (connection) => {
    const current = await triviaRepository.findAttemptByPublicIdForUpdate(connection, attemptPublicId);
    if (!current) throw new NotFoundError('No se encontró el intento de trivia.');
    assertTokenSubject(tokenPayload, current.responsePublicId);

    if (current.status === 'started' && isAttemptExpired(current)) {
      const progress = await triviaRepository.countAttemptProgress(connection, current.id);
      await triviaRepository.finalizeAttempt(connection, current.id, {
        status: 'expired',
        correctAnswers: progress.correctAnswers,
        won: false
      });
      current.status = 'expired';
      current.correctAnswers = progress.correctAnswers;
      current.won = 0;
      current.completedAt = new Date();
    }
    return current;
  });

  const rows = await triviaRepository.getAttemptQuestions(attempt.id);
  const questions = buildQuestions(rows, attempt.publicId);

  return {
    ...resultFromAttempt(attempt),
    remainingSeconds: attempt.status === 'started' ? remainingSeconds(attempt) : 0,
    expiresAt: attempt.expiresAt,
    questions: questions.map((question) => ({
      id: question.id,
      order: question.order,
      text: question.text,
      selectedOptionId: question.selectedOptionId,
      isCorrect: question.isCorrect,
      correctOptionId: question.correctOptionId,
      options: question.options
    }))
  };
}

async function expireStaleAttempts() {
  return triviaRepository.expireStaleAttempts(config.trivia.graceSeconds);
}

module.exports = {
  startTrivia,
  getTriviaAvailability,
  answerQuestion,
  finishTrivia,
  getAttemptStatus,
  expireStaleAttempts,
  isAttemptExpired
};
