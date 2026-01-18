const { query } = require('../db/pool');
const { NotFoundError, mapPostgresError, BadRequestError } = require('../utils/errors');

class EmployeesService {
  /**
   * PUBLIC_INTERFACE
   * List employees with pagination, optional filtering, and sorting.
   */
  async list({ limit, offset, sortBy, sortDir, status, team, q }) {
    const where = [];
    const params = [];
    let i = 1;

    if (status) {
      where.push(`status = $${i++}`);
      params.push(status);
    }
    if (team) {
      where.push(`team = $${i++}`);
      params.push(team);
    }
    if (q) {
      where.push(`(full_name ILIKE $${i} OR email ILIKE $${i} OR employee_code ILIKE $${i})`);
      params.push(`%${q}%`);
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*)::int AS count FROM employees ${whereSql}`, params);
    const total = countRes.rows[0]?.count ?? 0;

    const listRes = await query(
      `SELECT id, employee_code, full_name, email, team, title, status, created_at, updated_at
       FROM employees
       ${whereSql}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    return { items: listRes.rows, total };
  }

  /**
   * PUBLIC_INTERFACE
   * Get an employee by id.
   */
  async getById(id) {
    const res = await query(
      `SELECT id, employee_code, full_name, email, team, title, status, created_at, updated_at
       FROM employees
       WHERE id = $1`,
      [id]
    );
    const employee = res.rows[0];
    if (!employee) throw new NotFoundError('Employee not found', { id });
    return employee;
  }

  /**
   * PUBLIC_INTERFACE
   * Create an employee.
   */
  async create(payload) {
    if (payload?.status && !['active', 'inactive'].includes(payload.status)) {
      throw new BadRequestError('Invalid status', { allowed: ['active', 'inactive'] });
    }

    try {
      const res = await query(
        `INSERT INTO employees (employee_code, full_name, email, team, title, status)
         VALUES ($1,$2,$3,$4,$5, COALESCE($6,'active'))
         RETURNING id, employee_code, full_name, email, team, title, status, created_at, updated_at`,
        [
          payload.employee_code || null,
          payload.full_name,
          payload.email || null,
          payload.team || null,
          payload.title || null,
          payload.status || null,
        ]
      );
      return res.rows[0];
    } catch (err) {
      const mapped = mapPostgresError(err, {
        uniqueMessage: 'Employee already exists (duplicate email or employee_code)',
      });
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Update an employee.
   */
  async update(id, payload) {
    if (payload?.status && !['active', 'inactive'].includes(payload.status)) {
      throw new BadRequestError('Invalid status', { allowed: ['active', 'inactive'] });
    }

    // build dynamic update for allowed fields
    const allowed = ['employee_code', 'full_name', 'email', 'team', 'title', 'status'];
    const sets = [];
    const params = [];
    let i = 1;

    for (const key of allowed) {
      if (payload[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        params.push(payload[key]);
      }
    }

    if (!sets.length) {
      throw new BadRequestError('No updatable fields provided', { allowed });
    }

    params.push(id);

    try {
      const res = await query(
        `UPDATE employees
         SET ${sets.join(', ')}
         WHERE id = $${i}
         RETURNING id, employee_code, full_name, email, team, title, status, created_at, updated_at`,
        params
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Employee not found', { id });
      return row;
    } catch (err) {
      const mapped = mapPostgresError(err, {
        uniqueMessage: 'Employee update conflicts with existing email or employee_code',
      });
      if (mapped) throw mapped;
      throw err;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Delete an employee.
   */
  async remove(id) {
    try {
      const res = await query('DELETE FROM employees WHERE id = $1 RETURNING id', [id]);
      const row = res.rows[0];
      if (!row) throw new NotFoundError('Employee not found', { id });
      return { id: row.id };
    } catch (err) {
      const mapped = mapPostgresError(err, {
        fkMessage: 'Cannot delete employee due to existing related records',
      });
      if (mapped) throw mapped;
      throw err;
    }
  }
}

module.exports = new EmployeesService();
