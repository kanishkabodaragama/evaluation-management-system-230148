const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Evaluation Management API',
      version: '1.0.0',
      description:
        'REST API for structured intern/employee evaluations (sessions, criteria, assignments, submissions, scores).',
    },
    tags: [
      { name: 'Employees', description: 'Employee directory (admin-managed)' },
      { name: 'Criteria', description: 'Evaluation criteria (admin-managed)' },
      { name: 'Sessions', description: 'Review sessions (admin-managed)' },
      { name: 'Assignments', description: 'Session reviewer assignments' },
      { name: 'Submissions', description: 'Reviewer submissions' },
      { name: 'Scores', description: 'Per-criterion scores for submissions' },
      { name: 'Analytics', description: 'Admin-only analytics + CSV exports' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste Supabase access_token as: Bearer <token>',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // includes src/routes/api.js
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
