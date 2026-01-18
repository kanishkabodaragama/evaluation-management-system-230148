const sessionsService = require('../services/sessions');
const { requireBodyFields, requireUuid, parsePagination, parseSort } = require('../utils/validation');
const { BadRequestError } = require('../utils/errors');

class SessionsController {
  /**
   * PUBLIC_INTERFACE
   * GET /api/sessions
   */
  async list(req, res) {
    const { limit, offset } = parsePagination(req);
    const { sortBy, sortDir } = parseSort(
      req,
      ['created_at', 'updated_at', 'name', 'status', 'start_date', 'end_date'],
      { defaultField: 'created_at', defaultDir: 'desc' }
    );

    const status = req.query.status ? String(req.query.status) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;

    if (status && !['draft', 'active', 'closed', 'archived'].includes(status)) {
      throw new BadRequestError('Invalid status filter', {
        allowed: ['draft', 'active', 'closed', 'archived'],
      });
    }

    const result = await sessionsService.list({ limit, offset, sortBy, sortDir, status, q });
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/sessions/:id
   */
  async get(req, res) {
    requireUuid(req.params.id, 'id');
    const item = await sessionsService.getById(req.params.id);
    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * POST /api/sessions
   */
  async create(req, res) {
    requireBodyFields(req, ['name']);
    const item = await sessionsService.create(req.body);
    return res.status(201).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * PUT /api/sessions/:id
   */
  async update(req, res) {
    requireUuid(req.params.id, 'id');
    const item = await sessionsService.update(req.params.id, req.body || {});
    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * DELETE /api/sessions/:id
   */
  async remove(req, res) {
    requireUuid(req.params.id, 'id');
    const result = await sessionsService.remove(req.params.id);
    return res.status(200).json(result);
  }
}

module.exports = new SessionsController();
