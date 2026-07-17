const express = require('express');
const healthRoutes = require('./health.routes');
const publicRoutes = require('./public.routes');
const adminRoutes = require('./admin.routes');
const { sessionMiddleware } = require('../config/session');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/public', publicRoutes);
router.use('/admin', sessionMiddleware, adminRoutes);

module.exports = router;
