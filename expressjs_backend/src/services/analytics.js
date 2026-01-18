const { query } = require('../db/pool');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class AnalyticsService {
  /**
   * PUBLIC_INTERFACE
   * Return summary analytics for a single session:
   * - assignment + submission counts
   * - completion rate
   * - average overall score (weighted by criterion weight)
   * - average score per criterion
   *
   * @param {string} sessionId uuid
   */
  async getSessionSummary(sessionId) {
    /** Validate session exists early to return 404 instead of empty aggregates. */
    const sessionRes = await query(
      `SELECT id, name, status, start_date, end_date
       FROM review_sessions
       WHERE id = $1`,
      [sessionId]
    );
    const session = sessionRes.rows[0];
    if (!session) throw new NotFoundError('Session not found', { id: sessionId });

    // Counts: assignments, submissions, submitted submissions, completion rate.
    const countsRes = await query(
      `
      SELECT
        $1::uuid AS session_id,
        COUNT(sa.id)::int AS assignments_count,
        COUNT(DISTINCT sub.id)::int AS submissions_count,
        COUNT(DISTINCT sub.id) FILTER (WHERE sub.status = 'submitted')::int AS submissions_submitted_count,
        COUNT(DISTINCT sa.id) FILTER (WHERE sa.status = 'completed')::int AS assignments_completed_count,
        CASE
          WHEN COUNT(sa.id) = 0 THEN 0
          ELSE ROUND((COUNT(sa.id) FILTER (WHERE sa.status = 'completed')::numeric / COUNT(sa.id)::numeric) * 100, 2)
        END AS assignment_completion_rate_pct
      FROM review_sessions rs
      LEFT JOIN session_assignments sa ON sa.session_id = rs.id
      LEFT JOIN submissions sub ON sub.session_id = rs.id
      WHERE rs.id = $1
      `,
      [sessionId]
    );

    // Weighted overall average score per submission (only submitted).
    // We compute per-submission weighted average, then average those to avoid biasing reviewers with more scores.
    const overallAvgRes = await query(
      `
      WITH per_submission AS (
        SELECT
          sub.id AS submission_id,
          CASE
            WHEN SUM(c.weight) FILTER (WHERE sc.score_value IS NOT NULL) = 0 THEN NULL
            ELSE SUM(sc.score_value * c.weight) / SUM(c.weight)
          END AS weighted_overall_score
        FROM submissions sub
        LEFT JOIN scores sc ON sc.submission_id = sub.id
        LEFT JOIN criteria c ON c.id = sc.criterion_id
        WHERE sub.session_id = $1
          AND sub.status = 'submitted'
        GROUP BY sub.id
      )
      SELECT
        AVG(weighted_overall_score)::float AS avg_overall_score,
        COUNT(*)::int AS submissions_with_any_score_count
      FROM per_submission
      `,
      [sessionId]
    );

    // Per-criterion averages for the session (only submitted submissions).
    const perCriterionRes = await query(
      `
      SELECT
        c.id AS criterion_id,
        c.name AS criterion_name,
        c.weight::float AS weight,
        AVG(sc.score_value)::float AS avg_score_value,
        COUNT(sc.id)::int AS score_count
      FROM criteria c
      LEFT JOIN scores sc ON sc.criterion_id = c.id
      LEFT JOIN submissions sub ON sub.id = sc.submission_id
      WHERE sub.session_id = $1
        AND sub.status = 'submitted'
      GROUP BY c.id, c.name, c.weight
      ORDER BY c.sort_order ASC, c.name ASC
      `,
      [sessionId]
    );

    return {
      session,
      counts: countsRes.rows[0] || {
        session_id: sessionId,
        assignments_count: 0,
        submissions_count: 0,
        submissions_submitted_count: 0,
        assignments_completed_count: 0,
        assignment_completion_rate_pct: 0,
      },
      averages: {
        avg_overall_score: overallAvgRes.rows[0]?.avg_overall_score ?? null,
        submissions_with_any_score_count: overallAvgRes.rows[0]?.submissions_with_any_score_count ?? 0,
      },
      per_criterion: perCriterionRes.rows,
    };
  }

  /**
   * PUBLIC_INTERFACE
   * Paginated employee analytics within a session:
   * - per employee: assignment count, submissions count, submitted count, avg overall score
   *
   * @param {{ sessionId: string, limit: number, offset: number }} args
   */
  async listSessionEmployees({ sessionId, limit, offset }) {
    if (!Number.isInteger(limit) || !Number.isInteger(offset)) {
      throw new BadRequestError('Invalid pagination');
    }

    const sessionRes = await query('SELECT 1 AS ok FROM review_sessions WHERE id = $1', [sessionId]);
    if (!sessionRes.rows[0]) throw new NotFoundError('Session not found', { id: sessionId });

    const countRes = await query(
      `
      SELECT COUNT(DISTINCT e.id)::int AS count
      FROM employees e
      INNER JOIN session_assignments sa ON sa.employee_id = e.id
      WHERE sa.session_id = $1
      `,
      [sessionId]
    );
    const total = countRes.rows[0]?.count ?? 0;

    const listRes = await query(
      `
      WITH per_submission AS (
        SELECT
          sub.id AS submission_id,
          sub.employee_id,
          CASE
            WHEN SUM(c.weight) FILTER (WHERE sc.score_value IS NOT NULL) = 0 THEN NULL
            ELSE SUM(sc.score_value * c.weight) / SUM(c.weight)
          END AS weighted_overall_score
        FROM submissions sub
        LEFT JOIN scores sc ON sc.submission_id = sub.id
        LEFT JOIN criteria c ON c.id = sc.criterion_id
        WHERE sub.session_id = $1
          AND sub.status = 'submitted'
        GROUP BY sub.id, sub.employee_id
      ),
      employee_rollup AS (
        SELECT
          e.id AS employee_id,
          e.employee_code,
          e.full_name,
          e.email,
          e.team,
          COUNT(DISTINCT sa.id)::int AS assignments_count,
          COUNT(DISTINCT sub.id)::int AS submissions_count,
          COUNT(DISTINCT sub.id) FILTER (WHERE sub.status = 'submitted')::int AS submissions_submitted_count,
          AVG(ps.weighted_overall_score)::float AS avg_overall_score
        FROM employees e
        INNER JOIN session_assignments sa
          ON sa.employee_id = e.id AND sa.session_id = $1
        LEFT JOIN submissions sub
          ON sub.employee_id = e.id AND sub.session_id = $1
        LEFT JOIN per_submission ps
          ON ps.employee_id = e.id
        GROUP BY e.id, e.employee_code, e.full_name, e.email, e.team
      )
      SELECT *
      FROM employee_rollup
      ORDER BY full_name ASC
      LIMIT $2 OFFSET $3
      `,
      [sessionId, limit, offset]
    );

    return { items: listRes.rows, total };
  }

  /**
   * PUBLIC_INTERFACE
   * Paginated reviewer analytics for a session:
   * - per reviewer: assignments count, completed count, completion rate, submissions submitted count
   *
   * @param {{ sessionId: string, limit: number, offset: number }} args
   */
  async listSessionReviewers({ sessionId, limit, offset }) {
    if (!Number.isInteger(limit) || !Number.isInteger(offset)) {
      throw new BadRequestError('Invalid pagination');
    }

    const sessionRes = await query('SELECT 1 AS ok FROM review_sessions WHERE id = $1', [sessionId]);
    if (!sessionRes.rows[0]) throw new NotFoundError('Session not found', { id: sessionId });

    const countRes = await query(
      `
      SELECT COUNT(DISTINCT u.id)::int AS count
      FROM users u
      INNER JOIN session_assignments sa ON sa.reviewer_user_id = u.id
      WHERE sa.session_id = $1
      `,
      [sessionId]
    );
    const total = countRes.rows[0]?.count ?? 0;

    const listRes = await query(
      `
      WITH reviewer_rollup AS (
        SELECT
          u.id AS reviewer_user_id,
          u.email AS reviewer_email,
          COUNT(sa.id)::int AS assignments_count,
          COUNT(sa.id) FILTER (WHERE sa.status = 'completed')::int AS assignments_completed_count,
          CASE
            WHEN COUNT(sa.id) = 0 THEN 0
            ELSE ROUND((COUNT(sa.id) FILTER (WHERE sa.status = 'completed')::numeric / COUNT(sa.id)::numeric) * 100, 2)
          END AS assignment_completion_rate_pct,
          COUNT(DISTINCT sub.id) FILTER (WHERE sub.status = 'submitted')::int AS submissions_submitted_count
        FROM users u
        INNER JOIN session_assignments sa
          ON sa.reviewer_user_id = u.id AND sa.session_id = $1
        LEFT JOIN submissions sub
          ON sub.reviewer_user_id = u.id AND sub.session_id = $1
        GROUP BY u.id, u.email
      )
      SELECT *
      FROM reviewer_rollup
      ORDER BY reviewer_email ASC NULLS LAST
      LIMIT $2 OFFSET $3
      `,
      [sessionId, limit, offset]
    );

    return { items: listRes.rows, total };
  }

  /**
   * PUBLIC_INTERFACE
   * CSV dataset for a single session: one row per assignment (employee x reviewer).
   * Includes: assignment status, submission status, submitted_at, and weighted overall score.
   *
   * @param {string} sessionId uuid
   * @returns {Promise<object[]>}
   */
  async getSessionExportRows(sessionId) {
    const sessionRes = await query('SELECT 1 AS ok FROM review_sessions WHERE id = $1', [sessionId]);
    if (!sessionRes.rows[0]) throw new NotFoundError('Session not found', { id: sessionId });

    return (await query(
      `
      WITH per_submission AS (
        SELECT
          sub.id AS submission_id,
          CASE
            WHEN SUM(c.weight) FILTER (WHERE sc.score_value IS NOT NULL) = 0 THEN NULL
            ELSE SUM(sc.score_value * c.weight) / SUM(c.weight)
          END AS weighted_overall_score
        FROM submissions sub
        LEFT JOIN scores sc ON sc.submission_id = sub.id
        LEFT JOIN criteria c ON c.id = sc.criterion_id
        WHERE sub.session_id = $1
        GROUP BY sub.id
      )
      SELECT
        rs.id AS session_id,
        rs.name AS session_name,
        e.id AS employee_id,
        e.employee_code,
        e.full_name AS employee_name,
        e.email AS employee_email,
        u.id AS reviewer_user_id,
        u.email AS reviewer_email,
        sa.id AS assignment_id,
        sa.status AS assignment_status,
        sub.id AS submission_id,
        sub.status AS submission_status,
        sub.submitted_at,
        ps.weighted_overall_score::float AS overall_score
      FROM review_sessions rs
      INNER JOIN session_assignments sa ON sa.session_id = rs.id
      INNER JOIN employees e ON e.id = sa.employee_id
      INNER JOIN users u ON u.id = sa.reviewer_user_id
      LEFT JOIN submissions sub
        ON sub.assignment_id = sa.id
      LEFT JOIN per_submission ps
        ON ps.submission_id = sub.id
      WHERE rs.id = $1
      ORDER BY e.full_name ASC, u.email ASC
      `,
      [sessionId]
    )).rows;
  }

  /**
   * PUBLIC_INTERFACE
   * CSV dataset for employees across all sessions (optionally filtered by session_id).
   * Includes: session metadata, assignment + submission status, submitted_at, weighted overall score.
   *
   * @param {{ sessionId?: string|null }} args
   * @returns {Promise<object[]>}
   */
  async getEmployeesExportRows({ sessionId = null } = {}) {
    const params = [];
    let whereSql = '';
    if (sessionId) {
      params.push(sessionId);
      whereSql = 'WHERE rs.id = $1';
    }

    return (await query(
      `
      WITH per_submission AS (
        SELECT
          sub.id AS submission_id,
          CASE
            WHEN SUM(c.weight) FILTER (WHERE sc.score_value IS NOT NULL) = 0 THEN NULL
            ELSE SUM(sc.score_value * c.weight) / SUM(c.weight)
          END AS weighted_overall_score
        FROM submissions sub
        LEFT JOIN scores sc ON sc.submission_id = sub.id
        LEFT JOIN criteria c ON c.id = sc.criterion_id
        GROUP BY sub.id
      )
      SELECT
        rs.id AS session_id,
        rs.name AS session_name,
        rs.status AS session_status,
        e.id AS employee_id,
        e.employee_code,
        e.full_name AS employee_name,
        e.email AS employee_email,
        e.team,
        e.title,
        sa.id AS assignment_id,
        sa.status AS assignment_status,
        u.id AS reviewer_user_id,
        u.email AS reviewer_email,
        sub.id AS submission_id,
        sub.status AS submission_status,
        sub.submitted_at,
        ps.weighted_overall_score::float AS overall_score
      FROM review_sessions rs
      INNER JOIN session_assignments sa ON sa.session_id = rs.id
      INNER JOIN employees e ON e.id = sa.employee_id
      INNER JOIN users u ON u.id = sa.reviewer_user_id
      LEFT JOIN submissions sub
        ON sub.assignment_id = sa.id
      LEFT JOIN per_submission ps
        ON ps.submission_id = sub.id
      ${whereSql}
      ORDER BY rs.created_at DESC, e.full_name ASC, u.email ASC
      `,
      params
    )).rows;
  }
}

module.exports = new AnalyticsService();
