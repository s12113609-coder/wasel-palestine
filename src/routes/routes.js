const router = require('express').Router();
const { query } = require('express-validator');
const ctrl = require('../controllers/routeController');
const { validate } = require('../middleware/errorHandler');

router.get('/estimate',
  query('from_lat').isFloat({ min: -90, max: 90 }),
  query('from_lng').isFloat({ min: -180, max: 180 }),
  query('to_lat').isFloat({ min: -90, max: 90 }),
  query('to_lng').isFloat({ min: -180, max: 180 }),
  query('avoid_checkpoints').optional().isBoolean(),
  validate,
  ctrl.estimate
);

module.exports = router;
