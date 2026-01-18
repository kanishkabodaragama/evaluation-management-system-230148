const scoresService = require('../services/scores');
const submissionsService = require('../services/submissions');
const { requireBodyFields, requireUuid, parsePagination, parseSort } = require('../utils/validation');
const { ForbiddenError } = require('../utils/errors');

class ScoresController {
  /**
   * PUBLIC_INTERFACE
   * GET /api/scores
   * Admin: all. Reviewer: restricted by submission ownership (requires submission_id filter or joins via per-item check).
   */
  async list(req, res) {
    const { limit, offset } = parsePagination(req);
    const { sortBy, sortDir } = parseSort(
      req,
      ['created_at', 'updated_at', 'score_value', 'submission_id', 'criterion_id'],
      { defaultField: 'created_at', defaultDir: 'desc' }
    );

    const submission_id = req.query.submission_id ? String(req.query.submission_id) : undefined;
    const criterion_id = req.query.criterion_id ? String(req.query.criterion_id) : undefined;

    if (submission_id) requireUuid(submission_id, 'submission_id');
    if (criterion_id) requireUuid(criterion_id, 'criterion_id');

    const role = req.user?.appRole;
    if (role === 'reviewer') {
      // Without a join (keep minimal), require submission_id so we can validate ownership cheaply.
      if (!submission_id) {
        throw new ForbiddenError('Reviewers must filter scores by submission_id');
      }
      const submission = await submissionsService.getById(submission_id);
      if (submission.reviewer_user_id !== req.user?.dbUserId) {
        throw new ForbiddenError('Cannot access scores for other reviewers');
      }
    }

    const result = await scoresService.list({ limit, offset, sortBy, sortDir, submission_id, criterion_id });
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/scores/:id
   */
  async get(req, res) {
    requireUuid(req.params.id, 'id');
    const item = await scoresService.getById(req.params.id);

    const role = req.user?.appRole;
    if (role === 'reviewer') {
      const submission = await submissionsService.getById(item.submission_id);
      if (submission.reviewer_user_id !== req.user?.dbUserId) {
        throw new ForbiddenError('Cannot access scores for other reviewers');
      }
    }

    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * POST /api/scores
   * Reviewer allowed only for own submission.
   */
  async create(req, res) {
    requireBodyFields(req, ['submission_id', 'criterion_id', 'score_value']);
    requireUuid(req.body.submission_id, 'submission_id');
    requireUuid(req.body.criterion_id, 'criterion_id');

    const role = req.user?.appRole;
    if (role === 'reviewer') {
      const submission = await submissionsService.getById(req.body.submission_id);
      if (submission.reviewer_user_id !== req.user?.dbUserId) {
        throw new ForbiddenError('Cannot create scores for other reviewers');
      }
    }

    const item = await scoresService.create(req.body);
    return res.status(201).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * PUT /api/scores/:id
   * Reviewer allowed only for own submission.
   */
  async update(req, res) {
    requireUuid(req.params.id, 'id');
    const existing = await scoresService.getById(req.params.id);

    const role = req.user?.appRole;
    if (role === 'reviewer') {
      const submission = await submissionsService.getById(existing.submission_id);
      if (submission.reviewer_user_id !== req.user?.dbUserId) {
        throw new ForbiddenError('Cannot update scores for other reviewers');
      }
    }

    const item = await scoresService.update(req.params.id, req.body || {});
    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * DELETE /api/scores/:id
   * Admin only (enforced by routes).
   */
  async remove(req, res) {
    requireUuid(req.params.id, 'id');
    const result = await scoresService.remove(req.params.id);
    return res.status(200).json(result);
  }
}

module.exports = new ScoresController();
