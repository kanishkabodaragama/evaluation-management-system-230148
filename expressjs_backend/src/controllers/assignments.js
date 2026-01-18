const assignmentsService = require('../services/assignments');
const { requireBodyFields, requireUuid, parsePagination, parseSort } = require('../utils/validation');
const { BadRequestError, ForbiddenError } = require('../utils/errors');

class AssignmentsController {
  /**
   * PUBLIC_INTERFACE
   * GET /api/assignments
   * Admin: can query all; Reviewer: restricted to own reviewer_user_id.
   */
  async list(req, res) {
    const { limit, offset } = parsePagination(req);
    const { sortBy, sortDir } = parseSort(
      req,
      ['created_at', 'updated_at', 'status', 'session_id', 'employee_id', 'reviewer_user_id'],
      { defaultField: 'created_at', defaultDir: 'desc' }
    );

    const session_id = req.query.session_id ? String(req.query.session_id) : undefined;
    const employee_id = req.query.employee_id ? String(req.query.employee_id) : undefined;
    let reviewer_user_id = req.query.reviewer_user_id ? String(req.query.reviewer_user_id) : undefined;

    if (session_id) requireUuid(session_id, 'session_id');
    if (employee_id) requireUuid(employee_id, 'employee_id');
    if (reviewer_user_id) requireUuid(reviewer_user_id, 'reviewer_user_id');

    const role = req.user?.appRole;
    const requesterUserId = req.user?.dbUserId;

    if (role === 'reviewer') {
      reviewer_user_id = requesterUserId;
    }

    const result = await assignmentsService.list({
      limit,
      offset,
      sortBy,
      sortDir,
      session_id,
      employee_id,
      reviewer_user_id,
    });
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/assignments/:id
   */
  async get(req, res) {
    requireUuid(req.params.id, 'id');
    const item = await assignmentsService.getById(req.params.id);

    const role = req.user?.appRole;
    if (role === 'reviewer' && item.reviewer_user_id !== req.user?.dbUserId) {
      throw new ForbiddenError('Cannot access assignments for other reviewers');
    }

    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * POST /api/assignments (admin only)
   */
  async create(req, res) {
    requireBodyFields(req, ['session_id', 'employee_id', 'reviewer_user_id']);
    requireUuid(req.body.session_id, 'session_id');
    requireUuid(req.body.employee_id, 'employee_id');
    requireUuid(req.body.reviewer_user_id, 'reviewer_user_id');

    if (req.body.status && !['assigned', 'in_progress', 'completed', 'cancelled'].includes(req.body.status)) {
      throw new BadRequestError('Invalid status', {
        allowed: ['assigned', 'in_progress', 'completed', 'cancelled'],
      });
    }

    const item = await assignmentsService.create(req.body);
    return res.status(201).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * PUT /api/assignments/:id (admin only)
   */
  async update(req, res) {
    requireUuid(req.params.id, 'id');
    const item = await assignmentsService.update(req.params.id, req.body || {});
    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * DELETE /api/assignments/:id (admin only)
   */
  async remove(req, res) {
    requireUuid(req.params.id, 'id');
    const result = await assignmentsService.remove(req.params.id);
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * Helper to ensure dbUserId is present; used by routes via middleware ordering.
   */
  assertDbUser(req) {
    if (!req.user?.dbUserId) {
      throw new ForbiddenError('User is not mapped to an app user record');
    }
  }
}

module.exports = new AssignmentsController();
