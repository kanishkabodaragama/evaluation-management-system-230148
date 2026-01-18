const express = require('express');
const healthController = require('../controllers/health');
const authController = require('../controllers/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

/**
 * @swagger
 * /health/db:
 *   get:
 *     summary: Health endpoint with DB connectivity check
 *     responses:
 *       200:
 *         description: Service and DB health check passed
 */
router.get('/health/db', healthController.checkWithDb.bind(healthController));

/**
 * @swagger
 * /me:
 *   get:
 *     summary: Get current user (requires Supabase JWT)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Missing/invalid token
 */
router.get('/me', requireAuth(), authController.me.bind(authController));

module.exports = router;
