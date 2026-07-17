const express = require('express');
const controller = require('../controllers/public.controller');
const { asyncHandler } = require('../middleware/async-handler');
const { validate } = require('../middleware/validate');
const { requireTriviaToken } = require('../middleware/trivia-token');
const {
  publicReadLimiter,
  surveySubmitLimiter,
  triviaLimiter
} = require('../middleware/rate-limiters');
const {
  submitSurveySchema,
  resolveBranchQuerySchema,
  startTriviaSchema,
  responsePublicIdParamsSchema,
  attemptParamsSchema,
  answerTriviaSchema
} = require('../validators/public.schemas');

const router = express.Router();

router.get('/branches', publicReadLimiter, asyncHandler(controller.listBranches));
router.get(
  '/branches/resolve',
  publicReadLimiter,
  validate({ query: resolveBranchQuerySchema }),
  asyncHandler(controller.resolveBranch)
);
router.get('/survey', publicReadLimiter, asyncHandler(controller.getSurvey));
router.post(
  '/survey-responses',
  surveySubmitLimiter,
  validate({ body: submitSurveySchema }),
  asyncHandler(controller.submitSurvey)
);
router.get(
  '/survey-responses/:responsePublicId/trivia',
  triviaLimiter,
  requireTriviaToken,
  validate({ params: responsePublicIdParamsSchema }),
  asyncHandler(controller.getTriviaAvailability)
);
router.post(
  '/trivia/start',
  triviaLimiter,
  requireTriviaToken,
  validate({ body: startTriviaSchema }),
  asyncHandler(controller.startTrivia)
);
router.get(
  '/trivia/:attemptPublicId',
  triviaLimiter,
  requireTriviaToken,
  validate({ params: attemptParamsSchema }),
  asyncHandler(controller.getTriviaStatus)
);
router.post(
  '/trivia/:attemptPublicId/answer',
  triviaLimiter,
  requireTriviaToken,
  validate({ params: attemptParamsSchema, body: answerTriviaSchema }),
  asyncHandler(controller.answerTriviaQuestion)
);
router.post(
  '/trivia/:attemptPublicId/finish',
  triviaLimiter,
  requireTriviaToken,
  validate({ params: attemptParamsSchema }),
  asyncHandler(controller.finishTrivia)
);

module.exports = router;
