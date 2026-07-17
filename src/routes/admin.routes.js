const express = require('express');
const authController = require('../controllers/admin-auth.controller');
const dashboardController = require('../controllers/admin-dashboard.controller');
const responsesController = require('../controllers/admin-responses.controller');
const metaController = require('../controllers/admin-meta.controller');
const exportController = require('../controllers/admin-export.controller');
const { asyncHandler } = require('../middleware/async-handler');
const { validate } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { requireCsrf } = require('../middleware/csrf');
const { adminLoginLimiter } = require('../middleware/rate-limiters');
const {
  loginSchema,
  reportFiltersSchema,
  responsesQuerySchema,
  exportQuerySchema,
  publicIdParamsSchema
} = require('../validators/admin.schemas');

const router = express.Router();

router.post(
  '/auth/login',
  adminLoginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login)
);

router.use(requireAdmin);

router.get('/auth/me', asyncHandler(authController.me));
router.get('/auth/csrf', asyncHandler(authController.csrf));
router.post('/auth/logout', requireCsrf, asyncHandler(authController.logout));

router.get('/meta', asyncHandler(metaController.getMetadata));

router.get(
  '/dashboard/summary',
  validate({ query: reportFiltersSchema }),
  asyncHandler(dashboardController.summary)
);
router.get(
  '/dashboard/trend',
  validate({ query: reportFiltersSchema }),
  asyncHandler(dashboardController.trend)
);
router.get(
  '/dashboard/branches',
  validate({ query: reportFiltersSchema }),
  asyncHandler(dashboardController.branches)
);
router.get(
  '/dashboard/questions',
  validate({ query: reportFiltersSchema }),
  asyncHandler(dashboardController.questions)
);

router.get(
  '/responses',
  validate({ query: responsesQuerySchema }),
  asyncHandler(responsesController.list)
);
router.get(
  '/responses/:publicId',
  validate({ params: publicIdParamsSchema }),
  asyncHandler(responsesController.detail)
);
router.get(
  '/exports/responses.csv',
  validate({ query: exportQuerySchema }),
  asyncHandler(exportController.responsesCsv)
);

module.exports = router;
