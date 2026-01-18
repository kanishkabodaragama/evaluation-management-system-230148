const { query } = require('../db/pool');
const { withTransaction } = require('../db/tx');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
  mapPostgresError,
} = require('../utils/errors');
const assignmentsService = require('./assignments');

class SubmissionsService {
  /**
   * PUBLIC_INTERFACE
   * List submissions with pagination/filtering/sorting.
   * Access control should be enforced by controllers; this is a pure data operation.
   */
  async list({ limit, offset, sortBy, sortDir, session_id, employee_id, reviewer_user_id, status }) {
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
    if (status) {
      where.push(`status = $${i++}`);
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*)::int AS count FROM submissions ${whereSql}`,
      params
    );
    const total = countRes.rows[0]?.count ?? 0;

    const listRes = await query(
      `SELECT id, session_id, employee_id, reviewer_user_id, assignment_id,
              status, overall_comment, submitted_at, created_at, updated_at
       FROM submissions
       ${whereSql}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    return { items: listRes.rows, total };
  }

  /**
   * PUBLIC_INTERFACE
   * Get submission by id.
   */
  async getById(id) {
    const res = await query(
      `SELECT id, session_id, employee_id, reviewer_user_id, assignment_id,
              status, overall_comment, submitted_at, created_at, updated_at
       FROM submissions WHERE id = $1`,
      [id]
    );
    const row = res.rows[0];
    if (!row) throw new NotFoundError('Submission not found', { id });
    return row;
  }

  /**
   * PUBLIC_INTERFACE
   * Create submission. For reviewer workflows, require an assignment exists.
   */
  async create(payload) {
    if (payload.status && !['draft', 'submitted', 'reopened'].includes(payload.status)) {
      throw new BadRequestError('Invalid status', { allowed: ['draft', 'submitted', 'reopened'] });
    }

    // If assignment_id not provided, we can resolve it from assignments table (if exists).
    // Enforce that reviewer is assigned.
    const assignment = await assignmentsService.assertReviewerAssignment({
      session_id: payload.session_id,
      employee_id: payload.employee_id,
      reviewer_user_id: payload.reviewer_user_id,
    });

    const submittedAt = payload.status === 'submitted' ? new Date().toISOString() : null;

    try {
      const res = await query(
        `INSERT INTO submissions
          (session_id, employee_id, reviewer_user_id, assignment_id, status, overall_comment, submitted_at)
         VALUES ($1,$2,$3,$4, COALESCE($5,'draft'), $6, $7)
         RETURNING id, session_id, employee_id, reviewer_user_id, assignment_id,
                   status, overall_comment, submitted_at, created_at, updated_at`,
        [
          payload.session_id,
          payload.employee_id,
          payload.reviewer_user_id,
          payload.assignment_id || assignment.id,
          payload.status || null,
          payload.overall_comment || null,
          submittedAt,
        ]
      );
      return res.rows[0];
    } catch (err) {
      const mapped = mapPostgresError(err, {
        uniqueMessage: 'Submission already exists for that session/employee/reviewer',
      });
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Update submission (status/comment/submitted_at). If status becomes submitted, set submitted_at.
   */
  async update(id, payload) {
    if (payload.status && !['draft', 'submitted', 'reopened'].includes(payload.status)) {
      throw new BadRequestError('Invalid status', { allowed: ['draft', 'submitted', 'reopened'] });
    }

    // ensure exists
    const existing = await this.getById(id);

    // enforce status transitions lightly
    if (payload.status === 'submitted' && existing.status === 'submitted') {
      throw new ConflictError('Submission already submitted', { id });
    }

    return withTransaction(async (client) => {
      const fields = [];
      const params = [];
      let i = 1;

      if (payload.status !== undefined) {
        fields.push(`status = $${i++}`);
        params.push(payload.status);
        if (payload.status === 'submitted') {
          fields.push('submitted_at = COALESCE(submitted_at, now())');
        }
        if (payload.status !== 'submitted') {
          // allow clearing submitted_at only if explicitly passed
          if (payload.submitted_at === null) {
            fields.push('submitted_at = NULL');
          }
        }
      }

      if (payload.overall_comment !== undefined) {
        fields.push(`overall_comment = $${i++}`);
        params.push(payload.overall_comment);
      }

      if (payload.submitted_at !== undefined) {
        fields.push(`submitted_at = $${i++}`);
        params.push(payload.submitted_at);
      }

      if (!fields.length) {
        throw new BadRequestError('No updatable fields provided', {
          allowed: ['status', 'overall_comment', 'submitted_at'],
        });
      }

      params.push(id);

      try {
        const res = await client.query(
          `UPDATE submissions
           SET ${fields.join(', ')}
           WHERE id = $${i}
           RETURNING id, session_id, employee_id, reviewer_user_id, assignment_id,
                     status, overall_comment, submitted_at, created_at, updated_at`,
          params
        );

        const row = res.rows[0];
        if (!row) throw new NotFoundError('Submission not found', { id });
        return row;
      } catch (err) {
        const mapped = mapPostgresError(err);
        if (mapped) throw mapped;
        throw err;
      }
    });
  }

  /**
   * PUBLIC_INTERFACE
   * Delete submission.
   */
  async remove(id) {
    try {
      const res = await query('DELETE FROM submissions WHERE id = $1 RETURNING id', [id]);
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Submission not found', { id });
      return { id: row.id };
    } catch (err) {
      const mapped = mapPostgresError(err);
      if (mapped) throw mapped;
      throw err;
    }
  }
}

module.exports = new SubmissionsService();
