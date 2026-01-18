const { ApiError } = require('../utils/errors');

/**
 * PUBLIC_INTERFACE
 * Express error handling middleware.
 * Formats ApiError consistently; hides internal errors.
 */
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  const _next = next;

  const isApiError = err instanceof ApiError;

  if (!isApiError) {
    // eslint-disable-next-line no-console
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
