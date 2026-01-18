const express = require('express');
const { requireAuth, requireAdmin, requireReviewer } = require('../middleware');
const { requireDbUser } = require('../middleware/userContext');
const { asyncHandler } = require('../utils/validation');

const employeesController = require('../controllers/employees');
const criteriaController = require('../controllers/criteria');
const sessionsController = require('../controllers/sessions');
const assignmentsController = require('../controllers/assignments');
const submissionsController = require('../controllers/submissions');
const scoresController = require('../controllers/scores');
const analyticsController = require('../controllers/analytics');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Employees
 *     description: Employee directory (admin-managed)
 *   - name: Criteria
 *     description: Evaluation criteria (admin-managed)
 *   - name: Sessions
 *     description: Review sessions (admin-managed)
 *   - name: Assignments
 *     description: Session reviewer assignments
 *   - name: Submissions
 *     description: Reviewer submissions for an employee in a session
 *   - name: Scores
 *     description: Per-criterion scores for a submission
 *   - name: Analytics
 *     description: Admin-only analytics + CSV exports
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ApiError:
 *       type: object
 *       properties:
 *         status: { type: string, example: error }
 *         code: { type: string, example: bad_request }
 *         message: { type: string, example: Missing required fields }
 *         details: { type: object, nullable: true }
 *     ListResponse:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items: { type: object }
 *         total: { type: integer, example: 42 }
 *     Employee:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         employee_code: { type: string, nullable: true }
 *         full_name: { type: string }
 *         email: { type: string, nullable: true }
 *         team: { type: string, nullable: true }
 *         title: { type: string, nullable: true }
 *         status: { type: string, enum: [active, inactive] }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     Criterion:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         weight: { type: number }
 *         sort_order: { type: integer }
 *         is_active: { type: boolean }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     ReviewSession:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         start_date: { type: string, format: date, nullable: true }
 *         end_date: { type: string, format: date, nullable: true }
 *         status: { type: string, enum: [draft, active, closed, archived] }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     SessionAssignment:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         session_id: { type: string, format: uuid }
 *         employee_id: { type: string, format: uuid }
 *         reviewer_user_id: { type: string, format: uuid }
 *         status: { type: string, enum: [assigned, in_progress, completed, cancelled] }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     Submission:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         session_id: { type: string, format: uuid }
 *         employee_id: { type: string, format: uuid }
 *         reviewer_user_id: { type: string, format: uuid }
 *         assignment_id: { type: string, format: uuid, nullable: true }
 *         status: { type: string, enum: [draft, submitted, reopened] }
 *         overall_comment: { type: string, nullable: true }
 *         submitted_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     Score:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         submission_id: { type: string, format: uuid }
 *         criterion_id: { type: string, format: uuid }
 *         score_value: { type: number, minimum: 0, maximum: 10 }
 *         comment: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     SessionAnalyticsSummary:
 *       type: object
 *       properties:
 *         session:
 *           $ref: '#/components/schemas/ReviewSession'
 *         counts:
 *           type: object
 *           properties:
 *             session_id: { type: string, format: uuid }
 *             assignments_count: { type: integer }
 *             submissions_count: { type: integer }
 *             submissions_submitted_count: { type: integer }
 *             assignments_completed_count: { type: integer }
 *             assignment_completion_rate_pct: { type: number, description: "Percentage from 0-100" }
 *         averages:
 *           type: object
 *           properties:
 *             avg_overall_score: { type: number, nullable: true }
 *             submissions_with_any_score_count: { type: integer }
 *         per_criterion:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               criterion_id: { type: string, format: uuid }
 *               criterion_name: { type: string }
 *               weight: { type: number }
 *               avg_score_value: { type: number, nullable: true }
 *               score_count: { type: integer }
 *     SessionEmployeeAnalyticsRow:
 *       type: object
 *       properties:
 *         employee_id: { type: string, format: uuid }
 *         employee_code: { type: string, nullable: true }
 *         full_name: { type: string }
 *         email: { type: string, nullable: true }
 *         team: { type: string, nullable: true }
 *         assignments_count: { type: integer }
 *         submissions_count: { type: integer }
 *         submissions_submitted_count: { type: integer }
 *         avg_overall_score: { type: number, nullable: true }
 *     SessionReviewerAnalyticsRow:
 *       type: object
 *       properties:
 *         reviewer_user_id: { type: string, format: uuid }
 *         reviewer_email: { type: string, nullable: true }
 *         assignments_count: { type: integer }
 *         assignments_completed_count: { type: integer }
 *         assignment_completion_rate_pct: { type: number }
 *         submissions_submitted_count: { type: integer }
 *   parameters:
 *     LimitParam:
 *       in: query
 *       name: limit
 *       schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     OffsetParam:
 *       in: query
 *       name: offset
 *       schema: { type: integer, minimum: 0, default: 0 }
 *     SortByParam:
 *       in: query
 *       name: sortBy
 *       schema: { type: string }
 *     SortDirParam:
 *       in: query
 *       name: sortDir
 *       schema: { type: string, enum: [asc, desc] }
 */

const authed = [requireAuth(), requireDbUser()];

/**
 * @swagger
 * /api/employees:
 *   get:
 *     tags: [Employees]
 *     security: [{ bearerAuth: [] }]
 *     summary: List employees (admin)
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - $ref: '#/components/parameters/SortByParam'
 *       - $ref: '#/components/parameters/SortDirParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *       - in: query
 *         name: team
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { description: Employees list }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/employees', ...authed, requireAdmin(), asyncHandler(employeesController.list.bind(employeesController)));

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     tags: [Employees]
 *     security: [{ bearerAuth: [] }]
 *     summary: Get employee (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Employee }
 *       404: { description: Not found }
 */
router.get('/employees/:id', ...authed, requireAdmin(), asyncHandler(employeesController.get.bind(employeesController)));

router.post('/employees', ...authed, requireAdmin(), asyncHandler(employeesController.create.bind(employeesController)));
router.put('/employees/:id', ...authed, requireAdmin(), asyncHandler(employeesController.update.bind(employeesController)));
router.delete('/employees/:id', ...authed, requireAdmin(), asyncHandler(employeesController.remove.bind(employeesController)));

router.get('/criteria', ...authed, requireAdmin(), asyncHandler(criteriaController.list.bind(criteriaController)));
router.get('/criteria/:id', ...authed, requireAdmin(), asyncHandler(criteriaController.get.bind(criteriaController)));
router.post('/criteria', ...authed, requireAdmin(), asyncHandler(criteriaController.create.bind(criteriaController)));
router.put('/criteria/:id', ...authed, requireAdmin(), asyncHandler(criteriaController.update.bind(criteriaController)));
router.delete('/criteria/:id', ...authed, requireAdmin(), asyncHandler(criteriaController.remove.bind(criteriaController)));

router.get('/sessions', ...authed, requireAdmin(), asyncHandler(sessionsController.list.bind(sessionsController)));
router.get('/sessions/:id', ...authed, requireAdmin(), asyncHandler(sessionsController.get.bind(sessionsController)));
router.post('/sessions', ...authed, requireAdmin(), asyncHandler(sessionsController.create.bind(sessionsController)));
router.put('/sessions/:id', ...authed, requireAdmin(), asyncHandler(sessionsController.update.bind(sessionsController)));
router.delete('/sessions/:id', ...authed, requireAdmin(), asyncHandler(sessionsController.remove.bind(sessionsController)));

/**
 * Assignments: admin CRUD; reviewer can list/get own.
 */
router.get('/assignments', ...authed, requireReviewer(), asyncHandler(assignmentsController.list.bind(assignmentsController)));
router.get('/assignments/:id', ...authed, requireReviewer(), asyncHandler(assignmentsController.get.bind(assignmentsController)));
router.post('/assignments', ...authed, requireAdmin(), asyncHandler(assignmentsController.create.bind(assignmentsController)));
router.put('/assignments/:id', ...authed, requireAdmin(), asyncHandler(assignmentsController.update.bind(assignmentsController)));
router.delete('/assignments/:id', ...authed, requireAdmin(), asyncHandler(assignmentsController.remove.bind(assignmentsController)));

/**
 * Submissions: admin can read/manage; reviewer can read/manage own; delete admin-only.
 */
router.get('/submissions', ...authed, requireReviewer(), asyncHandler(submissionsController.list.bind(submissionsController)));
router.get('/submissions/:id', ...authed, requireReviewer(), asyncHandler(submissionsController.get.bind(submissionsController)));
router.post('/submissions', ...authed, requireReviewer(), asyncHandler(submissionsController.create.bind(submissionsController)));
router.put('/submissions/:id', ...authed, requireReviewer(), asyncHandler(submissionsController.update.bind(submissionsController)));
router.delete('/submissions/:id', ...authed, requireAdmin(), asyncHandler(submissionsController.remove.bind(submissionsController)));

/**
 * Scores: admin all; reviewer can manage only for own submissions.
 */
router.get('/scores', ...authed, requireReviewer(), asyncHandler(scoresController.list.bind(scoresController)));
router.get('/scores/:id', ...authed, requireReviewer(), asyncHandler(scoresController.get.bind(scoresController)));
router.post('/scores', ...authed, requireReviewer(), asyncHandler(scoresController.create.bind(scoresController)));
router.put('/scores/:id', ...authed, requireReviewer(), asyncHandler(scoresController.update.bind(scoresController)));
router.delete('/scores/:id', ...authed, requireAdmin(), asyncHandler(scoresController.remove.bind(scoresController)));

/**
 * @swagger
 * /api/analytics/sessions/{id}:
 *   get:
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     summary: Session analytics summary (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Session analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionAnalyticsSummary'
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.get(
  '/analytics/sessions/:id',
  ...authed,
  requireAdmin(),
  asyncHandler(analyticsController.getSessionSummary.bind(analyticsController))
);

/**
 * @swagger
 * /api/analytics/sessions/{id}/employees:
 *   get:
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     summary: Session analytics by employee (admin, paginated)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *     responses:
 *       200:
 *         description: Paginated employee analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SessionEmployeeAnalyticsRow' }
 *                 total: { type: integer }
 */
router.get(
  '/analytics/sessions/:id/employees',
  ...authed,
  requireAdmin(),
  asyncHandler(analyticsController.listSessionEmployees.bind(analyticsController))
);

/**
 * @swagger
 * /api/analytics/sessions/{id}/reviewers:
 *   get:
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     summary: Session analytics by reviewer (admin, paginated)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *     responses:
 *       200:
 *         description: Paginated reviewer analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SessionReviewerAnalyticsRow' }
 *                 total: { type: integer }
 */
router.get(
  '/analytics/sessions/:id/reviewers',
  ...authed,
  requireAdmin(),
  asyncHandler(analyticsController.listSessionReviewers.bind(analyticsController))
);

/**
 * @swagger
 * /api/analytics/sessions/{id}/export.csv:
 *   get:
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     summary: Export a session report as CSV (admin)
 *     description: Returns text/csv. Use this for downloading session-level analytics/export.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get(
  '/analytics/sessions/:id/export.csv',
  ...authed,
  requireAdmin(),
  asyncHandler(analyticsController.exportSessionCsv.bind(analyticsController))
);

/**
 * @swagger
 * /api/analytics/employees/export.csv:
 *   get:
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     summary: Export employees report as CSV (admin)
 *     description: Returns text/csv. Optional filter by session_id.
 *     parameters:
 *       - in: query
 *         name: session_id
 *         required: false
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get(
  '/analytics/employees/export.csv',
  ...authed,
  requireAdmin(),
  asyncHandler(analyticsController.exportEmployeesCsv.bind(analyticsController))
);

module.exports = router;
