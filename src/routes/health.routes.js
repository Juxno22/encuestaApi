const express = require('express');
const controller = require('../controllers/health.controller');
const { asyncHandler } = require('../middleware/async-handler');

const router = express.Router();

router.get('/live', controller.live);
router.get('/', asyncHandler(controller.ready));

module.exports = router;
