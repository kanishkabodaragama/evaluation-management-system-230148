const { query } = require('../db/pool');
const { NotFoundError, BadRequestError, mapPostgresError } = require('../utils/errors');

class SessionsService {
  /**
   * PUBLIC_INTERFACE
   * List sessions with pagination/filtering/sorting.
   */
  async list({ limit, offset, sortBy, sortDir, status, q }) {
    const where = [];
    const params = [];
    let i = 1;

    if (status) {
      where.push(`status = $${i++}`);
      params.push(status);
    }
    if (q) {
      where.push(`(name ILIKE $${i} OR description ILIKE $${i})`);
      params.push(`%${q}%`);
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*)::int AS count FROM review_sessions ${whereSql}`,
      params
    );
    const total = countRes.rows[0]?.count ?? 0;

    const listRes = await query(
      `SELECT id, name, description, start_date, end_date, status, created_at, updated_at
       FROM review_sessions
       ${whereSql}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    return { items: listRes.rows, total };
  }

  /**
   * PUBLIC_INTERFACE
   * Get session by id.
   */
  async getById(id) {
    const res = await query(
      `SELECT id, name, description, start_date, end_date, status, created_at, updated_at
       FROM review_sessions WHERE id = $1`,
      [id]
    );
    const row = res.rows[0];
    if (!row) throw new NotFoundError('Session not found', { id });
    return row;
  }

  /**
   * PUBLIC_INTERFACE
   * Create session.
   */
  async create(payload) {
    if (payload.status && !['draft', 'active', 'closed', 'archived'].includes(payload.status)) {
      throw new BadRequestError('Invalid status', {
        allowed: ['draft', 'active', 'closed', 'archived'],
      });
    }

    try {
      const res = await query(
        `INSERT INTO review_sessions (name, description, start_date, end_date, status)
         VALUES ($1,$2,$3,$4, COALESCE($5,'draft'))
         RETURNING id, name, description, start_date, end_date, status, created_at, updated_at`,
        [
          payload.name,
          payload.description || null,
          payload.start_date || null,
          payload.end_date || null,
          payload.status || null,
        ]
      );
      return res.rows[0];
    } catch (err) {
      const mapped = mapPostgresError(err);
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Update session.
   */
  async update(id, payload) {
    if (payload.status && !['draft', 'active', 'closed', 'archived'].includes(payload.status)) {
      throw new BadRequestError('Invalid status', {
        allowed: ['draft', 'active', 'closed', 'archived'],
      });
    }

    const allowed = ['name', 'description', 'start_date', 'end_date', 'status'];
    const sets = [];
    const params = [];
    let i = 1;

    for (const key of allowed) {
      if (payload[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        params.push(payload[key]);
      }
    }

    if (!sets.length) {
      throw new BadRequestError('No updatable fields provided', { allowed });
    }

    params.push(id);

    try {
      const res = await query(
        `UPDATE review_sessions
         SET ${sets.join(', ')}
         WHERE id = $${i}
         RETURNING id, name, description, start_date, end_date, status, created_at, updated_at`,
        params
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Session not found', { id });
      return row;
    } catch (err) {
      const mapped = mapPostgresError(err);
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Delete session.
   */
  async remove(id) {
    try {
      const res = await query('DELETE FROM review_sessions WHERE id = $1 RETURNING id', [id]);
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Session not found', { id });
      return { id: row.id };
    } catch (err) {
      const mapped = mapPostgresError(err, {
        fkMessage: 'Cannot delete session due to existing related records',
      });
      if (mapped) throw mapped;
      throw err;
    }
  }
}

module.exports = new SessionsService();
