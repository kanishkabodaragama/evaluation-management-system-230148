const { query } = require('../db/pool');
const { ForbiddenError } = require('../utils/errors');

/**
 * PUBLIC_INTERFACE
 * Middleware: attach application user record info (db user id) based on Supabase JWT.
 *
 * Strategy:
 * - Prefer match by users.auth_user_id == req.user.id (Supabase sub UUID)
 * - Fall back to users.email == req.user.email
 *
 * If no match:
 * - For admin-only routes, the role middleware will block before this matters.
 * - For reviewer scoped routes, we throw to avoid leaking data.
 */
function requireDbUser() {
  return async function requireDbUserMiddleware(req, res, next) {
    try {
      const supaUserId = req.user?.id;
      const email = req.user?.email;

      if (!supaUserId && !email) {
        return next(new ForbiddenError('Authenticated user missing identifier'));
      }

      let row = null;

      if (supaUserId) {
        const res1 = await query(
          `SELECT id, auth_user_id, email
           FROM users
           WHERE auth_user_id = $1
           LIMIT 1`,
          [supaUserId]
        );
        row = res1.rows[0] || null;
      }

      if (!row && email) {
        const res2 = await query(
          `SELECT id, auth_user_id, email
           FROM users
           WHERE email = $1
           LIMIT 1`,
          [email]
        );
        row = res2.rows[0] || null;
      }

      if (!row) {
        return next(new ForbiddenError('User is not registered in app users table'));
      }

      req.user = req.user || {};
      req.user.dbUserId = row.id;

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireDbUser };
