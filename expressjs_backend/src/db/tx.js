const { getPool } = require('./pool');

/**
 * PUBLIC_INTERFACE
 * Execute a callback within a Postgres transaction.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackErr) {
      // ignore rollback failures
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
