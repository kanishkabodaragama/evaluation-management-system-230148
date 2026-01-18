const { ApiError } = require('../utils/errors');

/**
 * PUBLIC_INTERFACE
 * Express error handling middleware.
 * Formats ApiError consistently; hides internal errors.
 */
function errorHandler(err, req, res, next) {
  // keep signature (err, req, res, next) for Express even if `next` unused
  void next;

  const isApiError = err instanceof ApiError;

  if (!isApiError) {
    console.error(err);
  }

  const status = isApiError ? err.status : 500;
  const code = isApiError ? err.code : 'internal_error';
  const message = isApiError ? err.message : 'Internal Server Error';
  const details = isApiError ? err.details : undefined;

  return res.status(status).json({
    status: 'error',
    code,
    message,
    details,
  });
}

module.exports = { errorHandler };
