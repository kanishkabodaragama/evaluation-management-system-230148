const submissionsService = require('../services/submissions');
const assignmentsService = require('../services/assignments');
const { requireBodyFields, requireUuid, parsePagination, parseSort } = require('../utils/validation');
const { ForbiddenError, BadRequestError } = require('../utils/errors');

class SubmissionsController {
  /**
   * PUBLIC_INTERFACE
   * GET /api/submissions
   * Admin: all; Reviewer: only own.
   */
  async list(req, res) {
    const { limit, offset } = parsePagination(req);
    const { sortBy, sortDir } = parseSort(
      req,
      ['created_at', 'updated_at', 'status', 'submitted_at', 'session_id', 'employee_id', 'reviewer_user_id'],
      { defaultField: 'created_at', defaultDir: 'desc' }
    );

    const session_id = req.query.session_id ? String(req.query.session_id) : undefined;
    const employee_id = req.query.employee_id ? String(req.query.employee_id) : undefined;
    let reviewer_user_id = req.query.reviewer_user_id ? String(req.query.reviewer_user_id) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    if (session_id) requireUuid(session_id, 'session_id');
    if (employee_id) requireUuid(employee_id, 'employee_id');
    if (reviewer_user_id) requireUuid(reviewer_user_id, 'reviewer_user_id');

    if (status && !['draft', 'submitted', 'reopened'].includes(status)) {
      throw new BadRequestError('Invalid status filter', { allowed: ['draft', 'submitted', 'reopened'] });
    }

    const role = req.user?.appRole;
    if (role === 'reviewer') {
      reviewer_user_id = req.user?.dbUserId;
    }

    const result = await submissionsService.list({
      limit,
      offset,
      sortBy,
      sortDir,
      session_id,
      employee_id,
      reviewer_user_id,
      status,
    });

    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/submissions/:id
   */
  async get(req, res) {
    requireUuid(req.params.id, 'id');
    const item = await submissionsService.getById(req.params.id);

    const role = req.user?.appRole;
    if (role === 'reviewer' && item.reviewer_user_id !== req.user?.dbUserId) {
      throw new ForbiddenError('Cannot access submissions for other reviewers');
    }

    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * POST /api/submissions
   * Reviewer creates for self (reviewer_user_id forced to dbUserId).
   */
  async create(req, res) {
    requireBodyFields(req, ['session_id', 'employee_id']);
    requireUuid(req.body.session_id, 'session_id');
    requireUuid(req.body.employee_id, 'employee_id');

    const role = req.user?.appRole;
    const reviewer_user_id = role === 'reviewer' ? req.user?.dbUserId : req.body.reviewer_user_id;

    if (!reviewer_user_id) {
      throw new BadRequestError('Missing reviewer_user_id (admin must provide)', { field: 'reviewer_user_id' });
    }
    requireUuid(reviewer_user_id, 'reviewer_user_id');

    // reviewer must be assigned (enforced in service)
    await assignmentsService.assertReviewerAssignment({
      session_id: req.body.session_id,
      employee_id: req.body.employee_id,
      reviewer_user_id,
    });

    const item = await submissionsService.create({
      ...req.body,
      reviewer_user_id,
    });

    return res.status(201).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * PUT /api/submissions/:id
   * Reviewer can update only own submission.
   */
  async update(req, res) {
    requireUuid(req.params.id, 'id');
    const existing = await submissionsService.getById(req.params.id);

    const role = req.user?.appRole;
    if (role === 'reviewer' && existing.reviewer_user_id !== req.user?.dbUserId) {
      throw new ForbiddenError('Cannot update submissions for other reviewers');
    }

    const item = await submissionsService.update(req.params.id, req.body || {});
    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * DELETE /api/submissions/:id
   * Admin only (enforced by routes).
   */
  async remove(req, res) {
    requireUuid(req.params.id, 'id');
    const result = await submissionsService.remove(req.params.id);
    return res.status(200).json(result);
  }
}

module.exports = new SubmissionsController();
