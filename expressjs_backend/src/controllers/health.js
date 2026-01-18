const healthService = require('../services/health');

class HealthController {
  check(req, res) {
    const healthStatus = healthService.getStatus();
    return res.status(200).json(healthStatus);
  }

  async checkWithDb(req, res, next) {
    try {
      const healthStatus = healthService.getStatus();
      const db = await healthService.getDbStatus();
      return res.status(200).json({ ...healthStatus, db });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new HealthController();
