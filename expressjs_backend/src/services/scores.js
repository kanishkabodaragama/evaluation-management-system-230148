const { query } = require('../db/pool');
const { NotFoundError, BadRequestError, mapPostgresError } = require('../utils/errors');

class ScoresService {
  async _exists(table, id) {
    const res = await query(`SELECT 1 AS ok FROM ${table} WHERE id = $1`, [id]);
    return !!res.rows[0];
  }

  /**
   * PUBLIC_INTERFACE
   * List scores with pagination/filtering/sorting.
   */
  async list({ limit, offset, sortBy, sortDir, submission_id, criterion_id }) {
    const where = [];
    const params = [];
    let i = 1;

    if (submission_id) {
      where.push(`submission_id = $${i++}`);
      params.push(submission_id);
    }
    if (criterion_id) {
      where.push(`criterion_id = $${i++}`);
      params.push(criterion_id);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*)::int AS count FROM scores ${whereSql}`, params);
    const total = countRes.rows[0]?.count ?? 0;

    const listRes = await query(
      `SELECT id, submission_id, criterion_id, score_value, comment, created_at, updated_at
       FROM scores
       ${whereSql}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    return { items: listRes.rows, total };
  }

  /**
   * PUBLIC_INTERFACE
   * Get score by id.
   */
  async getById(id) {
    const res = await query(
      `SELECT id, submission_id, criterion_id, score_value, comment, created_at, updated_at
       FROM scores WHERE id = $1`,
      [id]
    );
    const row = res.rows[0];
    if (!row) throw new NotFoundError('Score not found', { id });
    return row;
  }

  /**
   * PUBLIC_INTERFACE
   * Create score (requires submission + criterion exist).
   */
  async create(payload) {
    const val = Number(payload.score_value);
    if (!Number.isFinite(val) || val < 0 || val > 10) {
      throw new BadRequestError('score_value must be between 0 and 10', { score_value: payload.score_value });
    }

    const [subOk, critOk] = await Promise.all([
      this._exists('submissions', payload.submission_id),
      this._exists('criteria', payload.criterion_id),
    ]);
    if (!subOk) throw new NotFoundError('Submission not found', { id: payload.submission_id });
    if (!critOk) throw new NotFoundError('Criterion not found', { id: payload.criterion_id });

    try {
      const res = await query(
        `INSERT INTO scores (submission_id, criterion_id, score_value, comment)
         VALUES ($1,$2,$3,$4)
         RETURNING id, submission_id, criterion_id, score_value, comment, created_at, updated_at`,
        [payload.submission_id, payload.criterion_id, val, payload.comment || null]
      );
      return res.rows[0];
    } catch (err) {
      const mapped = mapPostgresError(err, {
        uniqueMessage: 'Score already exists for that submission and criterion',
      });
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Update score.
   */
  async update(id, payload) {
    const allowed = ['score_value', 'comment'];
    const sets = [];
    const params = [];
    let i = 1;

    if (payload.score_value !== undefined) {
      const val = Number(payload.score_value);
      if (!Number.isFinite(val) || val < 0 || val > 10) {
        throw new BadRequestError('score_value must be between 0 and 10', { score_value: payload.score_value });
      }
      sets.push(`score_value = $${i++}`);
      params.push(val);
    }
    if (payload.comment !== undefined) {
      sets.push(`comment = $${i++}`);
      params.push(payload.comment);
    }

    if (!sets.length) throw new BadRequestError('No updatable fields provided', { allowed });

    params.push(id);

    try {
      const res = await query(
        `UPDATE scores
         SET ${sets.join(', ')}
         WHERE id = $${i}
         RETURNING id, submission_id, criterion_id, score_value, comment, created_at, updated_at`,
        params
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Score not found', { id });
      return row;
    } catch (err) {
      const mapped = mapPostgresError(err);
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Delete score.
   */
  async remove(id) {
    try {
      const res = await query('DELETE FROM scores WHERE id = $1 RETURNING id', [id]);
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Score not found', { id });
      return { id: row.id };
    } catch (err) {
      const mapped = mapPostgresError(err);
      if (mapped) throw mapped;
      throw err;
    }
  }
}

module.exports = new ScoresService();
