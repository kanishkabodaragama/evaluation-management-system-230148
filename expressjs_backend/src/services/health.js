const { query } = require('../db/pool');

class HealthService {
  getStatus() {
    return {
      status: 'ok',
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async getDbStatus() {
    const startedAt = Date.now();
    await query('select 1 as ok');
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  }
}

module.exports = new HealthService();
