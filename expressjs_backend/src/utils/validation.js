const { BadRequestError } = require('./errors');

/**
 * PUBLIC_INTERFACE
 * Require a set of fields on req.body. Throws BadRequestError if missing.
 * @param {import('express').Request} req
 * @param {string[]} fields
 */
function requireBodyFields(req, fields) {
  const missing = [];
  for (const field of fields) {
    if (req.body == null || req.body[field] === undefined || req.body[field] === null) {
      missing.push(field);
    }
  }
  if (missing.length) {
    throw new BadRequestError('Missing required fields', { missing });
  }
}

/**
 * PUBLIC_INTERFACE
 * Express middleware wrapper for async handlers.
 * @param {(req: any, res: any, next: any) => Promise<any>} fn
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  requireBodyFields,
  asyncHandler,
};
