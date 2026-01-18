const { query } = require('../db/pool');
const { NotFoundError, ConflictError, mapPostgresError, BadRequestError } = require('../utils/errors');

class AssignmentsService {
  async _exists(table, id) {
    const res = await query(`SELECT 1 AS ok FROM ${table} WHERE id = $1`, [id]);
    return !!res.rows[0];
  }

  /**
   * PUBLIC_INTERFACE
   * List assignments with pagination/filtering/sorting.
   * If reviewerUserId is provided, it restricts results to that reviewer.
   */
  async list({ limit, offset, sortBy, sortDir, session_id, employee_id, reviewer_user_id }) {
    const where = [];
    const params = [];
    let i = 1;

    if (session_id) {
      where.push(`session_id = $${i++}`);
      params.push(session_id);
    }
    if (employee_id) {
      where.push(`employee_id = $${i++}`);
      params.push(employee_id);
    }
    if (reviewer_user_id) {
      where.push(`reviewer_user_id = $${i++}`);
      params.push(reviewer_user_id);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*)::int AS count FROM session_assignments ${whereSql}`,
      params
    );
    const total = countRes.rows[0]?.count ?? 0;

    const listRes = await query(
      `SELECT id, session_id, employee_id, reviewer_user_id, status, created_at, updated_at
       FROM session_assignments
       ${whereSql}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    return { items: listRes.rows, total };
  }

  /**
   * PUBLIC_INTERFACE
   * Get assignment by id.
   */
  async getById(id) {
    const res = await query(
      `SELECT id, session_id, employee_id, reviewer_user_id, status, created_at, updated_at
       FROM session_assignments WHERE id = $1`,
      [id]
    );
    const row = res.rows[0];
    if (!row) throw new NotFoundError('Assignment not found', { id });
    return row;
  }

  /**
   * PUBLIC_INTERFACE
   * Create assignment (requires existing session, employee, reviewer user).
   */
  async create(payload) {
    if (payload.status && !['assigned', 'in_progress', 'completed', 'cancelled'].includes(payload.status)) {
      throw new BadRequestError('Invalid status', {
        allowed: ['assigned', 'in_progress', 'completed', 'cancelled'],
      });
    }

    const [sessionOk, employeeOk, reviewerOk] = await Promise.all([
      this._exists('review_sessions', payload.session_id),
      this._exists('employees', payload.employee_id),
      this._exists('users', payload.reviewer_user_id),
    ]);

    if (!sessionOk) throw new NotFoundError('Session not found', { id: payload.session_id });
    if (!employeeOk) throw new NotFoundError('Employee not found', { id: payload.employee_id });
    if (!reviewerOk) throw new NotFoundError('Reviewer user not found', { id: payload.reviewer_user_id });

    try {
      const res = await query(
        `INSERT INTO session_assignments (session_id, employee_id, reviewer_user_id, status)
         VALUES ($1,$2,$3, COALESCE($4,'assigned'))
         RETURNING id, session_id, employee_id, reviewer_user_id, status, created_at, updated_at`,
        [payload.session_id, payload.employee_id, payload.reviewer_user_id, payload.status || null]
      );
      return res.rows[0];
    } catch (err) {
      const mapped = mapPostgresError(err, {
        uniqueMessage: 'Assignment already exists for that session/employee/reviewer',
      });
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Update assignment.
   */
  async update(id, payload) {
    const allowed = ['status'];
    const sets = [];
    const params = [];
    let i = 1;

    for (const key of allowed) {
      if (payload[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        params.push(payload[key]);
      }
    }
    if (!sets.length) throw new BadRequestError('No updatable fields provided', { allowed });

    params.push(id);

    try {
      const res = await query(
        `UPDATE session_assignments
         SET ${sets.join(', ')}
         WHERE id = $${i}
         RETURNING id, session_id, employee_id, reviewer_user_id, status, created_at, updated_at`,
        params
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Assignment not found', { id });
      return row;
    } catch (err) {
      const mapped = mapPostgresError(err);
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Delete assignment.
   */
  async remove(id) {
    try {
      const res = await query('DELETE FROM session_assignments WHERE id = $1 RETURNING id', [id]);
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Assignment not found', { id });
      return { id: row.id };
    } catch (err) {
      // assignments are referenced by submissions.assignment_id with ON DELETE SET NULL, so deletion is generally ok
      const mapped = mapPostgresError(err);
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Ensure a reviewer has an assignment for a session+employee pair.
   * Useful for guarding reviewer-scoped submission operations.
   */
  async assertReviewerAssignment({ session_id, employee_id, reviewer_user_id }) {
    const res = await query(
      `SELECT id, status
       FROM session_assignments
       WHERE session_id=$1 AND employee_id=$2 AND reviewer_user_id=$3`,
      [session_id, employee_id, reviewer_user_id]
    );
    const row = res.rows[0];
    if (!row) {
      throw new ConflictError('Reviewer is not assigned to this employee in the session', {
        session_id,
        employee_id,
        reviewer_user_id,
      });
    }
    return row;
  }
}

module.exports = new AssignmentsService();
