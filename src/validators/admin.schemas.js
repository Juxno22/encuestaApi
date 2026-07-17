const { z } = require('zod');

const dateValue = z.string().trim().refine(
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
  'Fecha inválida.'
);

const loginSchema = z.object({
  username: z.string().trim().min(3).max(190),
  password: z.string().min(8).max(200)
});

const reportFiltersSchema = z.object({
  from: dateValue.optional(),
  to: dateValue.optional(),
  branchId: z.coerce.number().int().positive().optional()
});

const responsesQuerySchema = reportFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  trivia: z.enum(['all', 'not_played', 'played', 'won', 'lost']).default('all')
});

const exportQuerySchema = reportFiltersSchema.extend({
  search: z.string().trim().max(120).optional(),
  trivia: z.enum(['all', 'not_played', 'played', 'won', 'lost']).default('all')
});

const publicIdParamsSchema = z.object({
  publicId: z.string().uuid()
});

module.exports = {
  loginSchema,
  reportFiltersSchema,
  responsesQuerySchema,
  exportQuerySchema,
  publicIdParamsSchema
};
