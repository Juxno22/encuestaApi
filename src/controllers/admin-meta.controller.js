const reportService = require('../services/report.service');

async function getMetadata(_req, res) {
  const result = await reportService.getAdminMetadata();
  res.json({ success: true, data: result });
}

module.exports = { getMetadata };
