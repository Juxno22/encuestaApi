const { ValidationError } = require('../utils/app-error');

function validate(schemas) {
  return function validationMiddleware(req, _res, next) {
    const errors = [];

    for (const [location, schema] of Object.entries(schemas)) {
      const parsed = schema.safeParse(req[location]);
      if (!parsed.success) {
        errors.push(...parsed.error.issues.map((issue) => ({
          location,
          path: issue.path.join('.'),
          message: issue.message
        })));
      } else {
        req[location] = parsed.data;
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('Revisa los datos enviados.', errors));
    }

    return next();
  };
}

module.exports = { validate };
