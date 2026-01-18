const { BadRequestError } = require('./errors');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * Validate that a string is a UUID.
 * @param {string} value
 * @param {string} field
 */
function requireUuid(value, field = 'id') {
  if (!value || typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new BadRequestError('Invalid UUID', { field, value: value || null });
  }
}

/**
 * PUBLIC_INTERFACE
 * Parse limit/offset query params with bounds.
 * @param {import('express').Request} req
 * @param {{ defaultLimit?: number, maxLimit?: number }} [opts]
 * @returns {{ limit: number, offset: number }}
 */
function parsePagination(req, opts = {}) {
  const defaultLimit = opts.defaultLimit ?? 20;
  const maxLimit = opts.maxLimit ?? 100;

  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  let limit = defaultLimit;
  let offset = 0;

  if (limitRaw !== undefined) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestError('Invalid limit', { limit: limitRaw });
    }
    limit = Math.min(parsed, maxLimit);
  }

  if (offsetRaw !== undefined) {
    const parsed = Number(offsetRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestError('Invalid offset', { offset: offsetRaw });
    }
    offset = parsed;
  }

  return { limit, offset };
}

/**
 * PUBLIC_INTERFACE
 * Parse sort query (sortBy, sortDir) with allow-list. Returns SQL fragment parts.
 * @param {import('express').Request} req
 * @param {string[]} allowedFields
 * @param {{ defaultField?: string, defaultDir?: 'asc'|'desc' }} [opts]
 * @returns {{ sortBy: string, sortDir: 'asc'|'desc' }}
 */
function parseSort(req, allowedFields, opts = {}) {
  const defaultField = opts.defaultField ?? allowedFields[0];
  const defaultDir = opts.defaultDir ?? 'asc';

  const sortByRaw = req.query.sortBy;
  const sortDirRaw = req.query.sortDir;

  const sortBy = sortByRaw ? String(sortByRaw) : defaultField;
  if (!allowedFields.includes(sortBy)) {
    throw new BadRequestError('Invalid sortBy', { sortBy, allowed: allowedFields });
  }

  const sortDir = sortDirRaw ? String(sortDirRaw).toLowerCase() : defaultDir;
  if (!['asc', 'desc'].includes(sortDir)) {
    throw new BadRequestError('Invalid sortDir', { sortDir, allowed: ['asc', 'desc'] });
  }

  return { sortBy, sortDir };
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
  requireUuid,
  parsePagination,
  parseSort,
  asyncHandler,
};
