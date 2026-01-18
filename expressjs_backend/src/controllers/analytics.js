const analyticsService = require('../services/analytics');
const { requireUuid, parsePagination } = require('../utils/validation');
const { rowsToCsv } = require('../utils/csv');

class AnalyticsController {
  /**
   * PUBLIC_INTERFACE
   * GET /api/analytics/sessions/:id
   * Session summary analytics (admin only).
   */
  async getSessionSummary(req, res) {
    requireUuid(req.params.id, 'id');
    const result = await analyticsService.getSessionSummary(req.params.id);
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/analytics/sessions/:id/employees
   * Paginated per-employee analytics within the session (admin only).
   */
  async listSessionEmployees(req, res) {
    requireUuid(req.params.id, 'id');
    const { limit, offset } = parsePagination(req);
    const result = await analyticsService.listSessionEmployees({ sessionId: req.params.id, limit, offset });
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/analytics/sessions/:id/reviewers
   * Paginated per-reviewer analytics within the session (admin only).
   */
  async listSessionReviewers(req, res) {
    requireUuid(req.params.id, 'id');
    const { limit, offset } = parsePagination(req);
    const result = await analyticsService.listSessionReviewers({ sessionId: req.params.id, limit, offset });
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/analytics/sessions/:id/export.csv
   * CSV export for a single session (admin only).
   */
  async exportSessionCsv(req, res) {
    requireUuid(req.params.id, 'id');

    const rows = await analyticsService.getSessionExportRows(req.params.id);

    const csv = rowsToCsv(rows, [
      { key: 'session_id', header: 'session_id' },
      { key: 'session_name', header: 'session_name' },
      { key: 'employee_id', header: 'employee_id' },
      { key: 'employee_code', header: 'employee_code' },
      { key: 'employee_name', header: 'employee_name' },
      { key: 'employee_email', header: 'employee_email' },
      { key: 'reviewer_user_id', header: 'reviewer_user_id' },
      { key: 'reviewer_email', header: 'reviewer_email' },
      { key: 'assignment_id', header: 'assignment_id' },
      { key: 'assignment_status', header: 'assignment_status' },
      { key: 'submission_id', header: 'submission_id' },
      { key: 'submission_status', header: 'submission_status' },
      { key: 'submitted_at', header: 'submitted_at' },
      { key: 'overall_score', header: 'overall_score' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${req.params.id}.csv"`);
    return res.status(200).send(csv);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/analytics/employees/export.csv
   * CSV export for employees across sessions (admin only).
   * Optional query: session_id (uuid) to filter to one session.
   */
  async exportEmployeesCsv(req, res) {
    const session_id = req.query.session_id ? String(req.query.session_id) : null;
    if (session_id) requireUuid(session_id, 'session_id');

    const rows = await analyticsService.getEmployeesExportRows({ sessionId: session_id });

    const csv = rowsToCsv(rows, [
      { key: 'session_id', header: 'session_id' },
      { key: 'session_name', header: 'session_name' },
      { key: 'session_status', header: 'session_status' },
      { key: 'employee_id', header: 'employee_id' },
      { key: 'employee_code', header: 'employee_code' },
      { key: 'employee_name', header: 'employee_name' },
      { key: 'employee_email', header: 'employee_email' },
      { key: 'team', header: 'team' },
      { key: 'title', header: 'title' },
      { key: 'assignment_id', header: 'assignment_id' },
      { key: 'assignment_status', header: 'assignment_status' },
      { key: 'reviewer_user_id', header: 'reviewer_user_id' },
      { key: 'reviewer_email', header: 'reviewer_email' },
      { key: 'submission_id', header: 'submission_id' },
      { key: 'submission_status', header: 'submission_status' },
      { key: 'submitted_at', header: 'submitted_at' },
      { key: 'overall_score', header: 'overall_score' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employees-export.csv"');
    return res.status(200).send(csv);
  }
}

module.exports = new AnalyticsController();
