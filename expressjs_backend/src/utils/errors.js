class ApiError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code stable machine code
   * @param {string} message user-facing message
   * @param {object} [details] extra details
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * PUBLIC_INTERFACE
 * 400 Bad Request error.
 */
class BadRequestError extends ApiError {
  constructor(message, details) {
    super(400, 'bad_request', message || 'Bad request', details);
  }
}

/**
 * PUBLIC_INTERFACE
 * 401 Unauthorized error.
 */
class UnauthorizedError extends ApiError {
  constructor(message, details) {
    super(401, 'unauthorized', message || 'Unauthorized', details);
  }
}

/**
 * PUBLIC_INTERFACE
 * 403 Forbidden error.
 */
class ForbiddenError extends ApiError {
  constructor(message, details) {
    super(403, 'forbidden', message || 'Forbidden', details);
  }
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
};
