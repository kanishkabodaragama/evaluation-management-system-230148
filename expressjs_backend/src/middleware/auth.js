const { createRemoteJWKSet, jwtVerify } = require('jose');
const { UnauthorizedError } = require('../utils/errors');

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Supabase issues JWTs whose JWKs are available at:
 *   {SUPABASE_URL}/auth/v1/.well-known/jwks.json
 */
function getJwks() {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;
  const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', supabaseUrl);
  return createRemoteJWKSet(jwksUrl);
}

/**
 * PUBLIC_INTERFACE
 * Express middleware: verifies Supabase JWT and sets req.user/req.auth.
 *
 * Notes:
 * - Requires SUPABASE_URL env var.
 * - Authorization: Bearer <access_token>
 */
function requireAuth() {
  const jwks = getJwks();

  return async function requireAuthMiddleware(req, res, next) {
    try {
      if (!jwks) {
        throw new UnauthorizedError(
          'Auth not configured (missing SUPABASE_URL)',
          { missing: ['SUPABASE_URL'] }
        );
      }

      const token = getBearerToken(req);
      if (!token) {
        throw new UnauthorizedError('Missing Bearer token');
      }

      const { payload, protectedHeader } = await jwtVerify(token, jwks, {
        // Supabase uses project URL as issuer. We validate presence if provided.
        issuer: process.env.SUPABASE_JWT_ISSUER || undefined,
        audience: process.env.SUPABASE_JWT_AUD || undefined,
      });

      req.auth = {
        token,
        header: protectedHeader,
        claims: payload,
      };

      // Common Supabase fields: sub, email, role, app_metadata, user_metadata
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        app_metadata: payload.app_metadata,
        user_metadata: payload.user_metadata,
      };

      return next();
    } catch (err) {
      if (err instanceof UnauthorizedError) return next(err);

      // jose throws various errors; normalize them
      return next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}

module.exports = {
  requireAuth,
};
