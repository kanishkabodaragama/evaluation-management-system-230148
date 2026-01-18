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

/**
 * PUBLIC_INTERFACE
 * 404 Not Found error.
 */
class NotFoundError extends ApiError {
  constructor(message, details) {
    super(404, 'not_found', message || 'Not found', details);
  }
}

/**
 * PUBLIC_INTERFACE
 * 409 Conflict error (unique constraints, state conflicts, etc.)
 */
class ConflictError extends ApiError {
  constructor(message, details) {
    super(409, 'conflict', message || 'Conflict', details);
  }
}

/**
 * PUBLIC_INTERFACE
 * Convert a Postgres error into an ApiError when possible.
 * Keeps controller/service code unit-friendly and consistent.
 * @param {any} err
 * @param {{ uniqueMessage?: string, fkMessage?: string }} [messages]
 * @returns {ApiError|null}
 */
function mapPostgresError(err, messages = {}) {
  // pg error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
  const code = err?.code;

  // unique_violation
  if (code === '23505') {
    return new ConflictError(messages.uniqueMessage || 'Resource already exists', {
      constraint: err.constraint,
      detail: err.detail,
    });
  }

  // foreign_key_violation
  if (code === '23503') {
    return new ConflictError(messages.fkMessage || 'Foreign key constraint failed', {
      constraint: err.constraint,
      detail: err.detail,
    });
  }

  // check_violation
  if (code === '23514') {
    return new BadRequestError('Validation failed', {
      constraint: err.constraint,
      detail: err.detail,
    });
  }

  return null;
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  mapPostgresError,
};
