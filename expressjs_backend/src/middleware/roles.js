const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

function extractRole(req) {
  const claims = req?.auth?.claims;
  if (!claims) return null;

  // Prefer custom role in app_metadata; fall back to "role" claim.
  return claims?.app_metadata?.role || claims?.role || null;
}

/**
 * PUBLIC_INTERFACE
 * Express middleware factory to require one of the allowed roles.
 * Roles are expected in JWT claims: app_metadata.role (preferred) or role.
 * @param {string[]} allowedRoles
 */
function requireRole(allowedRoles) {
  return function requireRoleMiddleware(req, res, next) {
    if (!req.auth) return next(new UnauthorizedError('Not authenticated'));

    const role = extractRole(req);
    if (!role || !allowedRoles.includes(role)) {
      return next(
        new ForbiddenError('Insufficient role', {
          required: allowedRoles,
          actual: role || null,
        })
      );
    }

    req.user = req.user || {};
    req.user.appRole = role;

    return next();
  };
}

/**
 * PUBLIC_INTERFACE
 * Convenience middleware to require admin role.
 */
function requireAdmin() {
  return requireRole(['admin']);
}

/**
 * PUBLIC_INTERFACE
 * Convenience middleware to require reviewer role (or admin).
 */
function requireReviewer() {
  return requireRole(['reviewer', 'admin']);
}

module.exports = {
  requireRole,
  requireAdmin,
  requireReviewer,
};
