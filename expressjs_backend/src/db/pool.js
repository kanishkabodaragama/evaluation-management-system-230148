const { Pool } = require('pg');

/**
 * Creates and exports a singleton pg Pool using env vars.
 *
 * Env vars (provided by platform):
 * - POSTGRES_URL (optional; full connection string)
 * - POSTGRES_USER
 * - POSTGRES_PASSWORD
 * - POSTGRES_DB
 * - POSTGRES_PORT
 * - POSTGRES_HOST (optional; defaults to 'localhost' if POSTGRES_URL not set)
 */

let _pool;

/**
 * PUBLIC_INTERFACE
 * Get (and lazily initialize) the Postgres connection pool.
 * @returns {Pool} pg Pool instance
 */
function getPool() {
  if (_pool) return _pool;

  const connectionString = process.env.POSTGRES_URL;

  // Prefer POSTGRES_URL if present; otherwise construct config.
  const config = connectionString
    ? { connectionString }
    : {
        host: process.env.POSTGRES_HOST || 'localhost',
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : undefined,
      };

  _pool = new Pool({
    ...config,
    max: process.env.PG_POOL_MAX ? Number(process.env.PG_POOL_MAX) : 10,
    idleTimeoutMillis: process.env.PG_IDLE_TIMEOUT_MS
      ? Number(process.env.PG_IDLE_TIMEOUT_MS)
      : 30000,
    connectionTimeoutMillis: process.env.PG_CONN_TIMEOUT_MS
      ? Number(process.env.PG_CONN_TIMEOUT_MS)
      : 10000,
  });

  _pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Unexpected Postgres pool error:', err);
  });

  return _pool;
}

/**
 * PUBLIC_INTERFACE
 * Convenience helper to run a query using the shared pool.
 * @param {string} text SQL query
 * @param {any[]} [params] query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const pool = getPool();
  return pool.query(text, params);
}

module.exports = {
  getPool,
  query,
};
