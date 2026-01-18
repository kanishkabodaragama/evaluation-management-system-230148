const criteriaService = require('../services/criteria');
const { requireBodyFields, requireUuid, parsePagination, parseSort } = require('../utils/validation');

class CriteriaController {
  /**
   * PUBLIC_INTERFACE
   * GET /api/criteria
   */
  async list(req, res) {
    const { limit, offset } = parsePagination(req);
    const { sortBy, sortDir } = parseSort(req, ['sort_order', 'name', 'weight', 'is_active', 'created_at', 'updated_at'], {
      defaultField: 'sort_order',
      defaultDir: 'asc',
    });

    let is_active;
    if (req.query.is_active !== undefined) {
      const raw = String(req.query.is_active).toLowerCase();
      is_active = raw === 'true' ? true : raw === 'false' ? false : undefined;
    }

    const result = await criteriaService.list({ limit, offset, sortBy, sortDir, is_active });
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/criteria/:id
   */
  async get(req, res) {
    requireUuid(req.params.id, 'id');
    const item = await criteriaService.getById(req.params.id);
    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * POST /api/criteria
   */
  async create(req, res) {
    requireBodyFields(req, ['name']);
    const item = await criteriaService.create(req.body);
    return res.status(201).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * PUT /api/criteria/:id
   */
  async update(req, res) {
    requireUuid(req.params.id, 'id');
    const item = await criteriaService.update(req.params.id, req.body || {});
    return res.status(200).json({ item });
  }

  /**
   * PUBLIC_INTERFACE
   * DELETE /api/criteria/:id
   */
  async remove(req, res) {
    requireUuid(req.params.id, 'id');
    const result = await criteriaService.remove(req.params.id);
    return res.status(200).json(result);
  }
}

module.exports = new CriteriaController();
