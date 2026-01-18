const { query } = require('../db/pool');
const { NotFoundError, mapPostgresError, BadRequestError } = require('../utils/errors');

class CriteriaService {
  /**
   * PUBLIC_INTERFACE
   * List criteria with pagination/filtering/sorting.
   */
  async list({ limit, offset, sortBy, sortDir, is_active }) {
    const where = [];
    const params = [];
    let i = 1;

    if (is_active !== undefined && is_active !== null) {
      where.push(`is_active = $${i++}`);
      params.push(is_active);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*)::int AS count FROM criteria ${whereSql}`, params);
    const total = countRes.rows[0]?.count ?? 0;

    const listRes = await query(
      `SELECT id, name, description, weight, sort_order, is_active, created_at, updated_at
       FROM criteria
       ${whereSql}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    return { items: listRes.rows, total };
  }

  /**
   * PUBLIC_INTERFACE
   * Get criterion by id.
   */
  async getById(id) {
    const res = await query(
      `SELECT id, name, description, weight, sort_order, is_active, created_at, updated_at
       FROM criteria WHERE id = $1`,
      [id]
    );
    const row = res.rows[0];
    if (!row) throw new NotFoundError('Criterion not found', { id });
    return row;
  }

  /**
   * PUBLIC_INTERFACE
   * Create criterion.
   */
  async create(payload) {
    if (payload.weight !== undefined && Number(payload.weight) <= 0) {
      throw new BadRequestError('weight must be > 0', { weight: payload.weight });
    }

    try {
      const res = await query(
        `INSERT INTO criteria (name, description, weight, sort_order, is_active)
         VALUES ($1,$2, COALESCE($3,1.0), COALESCE($4,0), COALESCE($5,true))
         RETURNING id, name, description, weight, sort_order, is_active, created_at, updated_at`,
        [
          payload.name,
          payload.description || null,
          payload.weight ?? null,
          payload.sort_order ?? null,
          payload.is_active ?? null,
        ]
      );
      return res.rows[0];
    } catch (err) {
      const mapped = mapPostgresError(err, { uniqueMessage: 'Criterion name already exists' });
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Update criterion.
   */
  async update(id, payload) {
    if (payload.weight !== undefined && Number(payload.weight) <= 0) {
      throw new BadRequestError('weight must be > 0', { weight: payload.weight });
    }

    const allowed = ['name', 'description', 'weight', 'sort_order', 'is_active'];
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
        `UPDATE criteria
         SET ${sets.join(', ')}
         WHERE id = $${i}
         RETURNING id, name, description, weight, sort_order, is_active, created_at, updated_at`,
        params
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Criterion not found', { id });
      return row;
    } catch (err) {
      const mapped = mapPostgresError(err, { uniqueMessage: 'Criterion name already exists' });
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Delete criterion.
   */
  async remove(id) {
    try {
      const res = await query('DELETE FROM criteria WHERE id = $1 RETURNING id', [id]);
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Criterion not found', { id });
      return { id: row.id };
    } catch (err) {
      const mapped = mapPostgresError(err, {
        fkMessage: 'Cannot delete criterion due to existing related records (scores)',
      });
      if (mapped) throw mapped;
      throw err;
    }
  }
}

module.exports = new CriteriaService();
