const HttpError = require('../lib/httpError');

// validate(zodSchema) -> parses req.body, replaces it with the parsed value.
module.exports = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return next(new HttpError(400, parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')));
  }
  req.body = parsed.data;
  next();
};
