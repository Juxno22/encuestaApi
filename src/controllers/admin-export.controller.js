const reportService = require('../services/report.service');
const { writeAuditLog } = require('../services/audit.service');

async function responsesCsv(req, res) {
  const result = await reportService.exportResponsesCsv(req.query);

  await writeAuditLog({
    req,
    adminUserId: req.adminUser.id,
    action: 'EXPORT_SURVEY_RESPONSES',
    entityType: 'survey_response',
    metadata: {
      total: result.total,
      filters: req.query
    }
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(result.content);
}

module.exports = { responsesCsv };
