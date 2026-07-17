const reportService = require('../services/report.service');

async function summary(req, res) {
  const result = await reportService.getDashboardSummary(req.query);
  res.json({ success: true, data: result });
}

async function trend(req, res) {
  const result = await reportService.getTrend(req.query);
  res.json({ success: true, data: result });
}

async function branches(req, res) {
  const result = await reportService.getBranchPerformance(req.query);
  res.json({ success: true, data: result });
}

async function questions(req, res) {
  const result = await reportService.getQuestionAnalytics(req.query);
  res.json({ success: true, data: result });
}

module.exports = {
  summary,
  trend,
  branches,
  questions
};
