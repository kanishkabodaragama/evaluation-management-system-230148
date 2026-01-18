// This file exports middleware as the application grows
const { requireAuth } = require('./auth');
const { requireRole, requireAdmin, requireReviewer } = require('./roles');
const { errorHandler } = require('./errorHandler');

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin,
  requireReviewer,
  errorHandler,
};
