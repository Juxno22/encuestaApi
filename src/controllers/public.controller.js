const surveyService = require('../services/survey.service');
const triviaService = require('../services/trivia.service');

async function listBranches(_req, res) {
  const branches = await surveyService.listBranches();
  res.json({ success: true, data: branches });
}

async function resolveBranch(req, res) {
  const branch = await surveyService.resolveBranch(req.query);
  res.json({
    success: true,
    data: {
      slug: branch.slug,
      publicName: branch.publicName
    }
  });
}

async function getSurvey(_req, res) {
  const survey = await surveyService.getPublicSurvey();
  res.json({ success: true, data: survey });
}

async function submitSurvey(req, res) {
  const result = await surveyService.submitSurvey(req.body, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  res.status(201).json({ success: true, data: result });
}

async function getTriviaAvailability(req, res) {
  const result = await triviaService.getTriviaAvailability(
    req.params.responsePublicId,
    req.triviaToken
  );
  res.json({ success: true, data: result });
}

async function startTrivia(req, res) {
  const result = await triviaService.startTrivia(req.body.responsePublicId, req.triviaToken);
  res.status(201).json({ success: true, data: result });
}

async function answerTriviaQuestion(req, res) {
  const result = await triviaService.answerQuestion(
    req.params.attemptPublicId,
    req.body,
    req.triviaToken
  );
  res.json({ success: true, data: result });
}

async function finishTrivia(req, res) {
  const result = await triviaService.finishTrivia(req.params.attemptPublicId, req.triviaToken);
  res.json({ success: true, data: result });
}

async function getTriviaStatus(req, res) {
  const result = await triviaService.getAttemptStatus(req.params.attemptPublicId, req.triviaToken);
  res.json({ success: true, data: result });
}

module.exports = {
  listBranches,
  resolveBranch,
  getSurvey,
  submitSurvey,
  getTriviaAvailability,
  startTrivia,
  answerTriviaQuestion,
  finishTrivia,
  getTriviaStatus
};
