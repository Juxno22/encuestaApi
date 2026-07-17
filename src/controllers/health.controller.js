const { pingDatabase } = require('../config/database');

function live(_req, res) {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }
  });
}

async function ready(_req, res) {
  await pingDatabase();
  res.json({
    success: true,
    data: {
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = {
  live,
  ready
};
