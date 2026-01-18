const employeesService = require('../services/employees');
const { requireBodyFields, requireUuid, parsePagination, parseSort } = require('../utils/validation');
const { BadRequestError } = require('../utils/errors');

class EmployeesController {
  /**
   * PUBLIC_INTERFACE
   * GET /api/employees
   */
  async list(req, res) {
    const { limit, offset } = parsePagination(req);
    const { sortBy, sortDir } = parseSort(req, [
      'created_at',
      'updated_at',
      'full_name',
      'email',
      'employee_code',
      'team',
      'title',
      'status',
    ], { defaultField: 'created_at', defaultDir: 'desc' });

    const status = req.query.status ? String(req.query.status) : undefined;
    const team = req.query.team ? String(req.query.team) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;

    if (status && !['active', 'inactive'].includes(status)) {
      throw new BadRequestError('Invalid status filter', { allowed: ['active', 'inactive'] });
    }

    const result = await employeesService.list({ limit, offset, sortBy, sortDir, status, team, q });
    return res.status(200).json(result);
  }

  /**
   * PUBLIC_INTERFACE
   * GET /api/employees/:id
   */
  async get(req, res) {
    requireUuid(req.params.id, 'id');
    const employee = await employeesService.getById(req.params.id);
    return res.status(200).json({ item: employee });
  }

  /**
   * PUBLIC_INTERFACE
   * POST /api/employees
   */
  async create(req, res) {
    requireBodyFields(req, ['full_name']);
    const employee = await employeesService.create(req.body);
    return res.status(201).json({ item: employee });
  }

  /**
   * PUBLIC_INTERFACE
   * PUT /api/employees/:id
   */
  async update(req, res) {
    requireUuid(req.params.id, 'id');
    const employee = await employeesService.update(req.params.id, req.body || {});
    return res.status(200).json({ item: employee });
  }

  /**
   * PUBLIC_INTERFACE
   * DELETE /api/employees/:id
   */
  async remove(req, res) {
    requireUuid(req.params.id, 'id');
    const result = await employeesService.remove(req.params.id);
    return res.status(200).json(result);
  }
}

module.exports = new EmployeesController();
