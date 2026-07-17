const reportService = require('../services/report.service');

async function list(req, res) {
  const result = await reportService.listResponses(req.query);
  res.json({ success: true, data: result });
}

async function detail(req, res) {
  const result = await reportService.getResponseDetail(req.params.publicId);
  res.json({ success: true, data: result });
}

module.exports = {
  list,
  detail
};
