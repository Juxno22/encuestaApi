const { z } = require('zod');

const branchReferenceSchema = z.object({
  token: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/).optional()
}).refine((value) => Boolean(value.token || value.slug), {
  message: 'Debes indicar el token o slug de la sucursal.'
});

const surveyAnswerValueSchema = z.union([
  z.number().finite(),
  z.string().trim().max(5000)
]);

const submitSurveySchema = z.object({
  branch: branchReferenceSchema,
  source: z.enum(['qr', 'selector', 'direct']).default('direct'),
  startedAt: z.string().datetime({ offset: true }).optional(),
  privacyNoticeAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar el aviso de privacidad.' })
  }),
  customer: z.object({
    name: z.string().trim().max(150).optional().default(''),
    email: z.union([z.string().trim().email().max(190), z.literal('')]).optional().default(''),
    phone: z.string().trim().max(30).optional().default(''),
    contactConsent: z.boolean().optional().default(false)
  }).optional().default({}),
  answers: z.record(z.string().min(1).max(60), surveyAnswerValueSchema)
});

const resolveBranchQuerySchema = z.object({
  token: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/).optional()
}).refine((value) => Boolean(value.token || value.slug), {
  message: 'Debes indicar token o slug.'
});

const startTriviaSchema = z.object({
  responsePublicId: z.string().uuid()
});

const responsePublicIdParamsSchema = z.object({
  responsePublicId: z.string().uuid()
});

const attemptParamsSchema = z.object({
  attemptPublicId: z.string().uuid()
});

const answerTriviaSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  optionId: z.coerce.number().int().positive()
});

module.exports = {
  submitSurveySchema,
  resolveBranchQuerySchema,
  startTriviaSchema,
  responsePublicIdParamsSchema,
  attemptParamsSchema,
  answerTriviaSchema
};
