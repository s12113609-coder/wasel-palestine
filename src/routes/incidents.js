const router = require('express').Router();
const { body, query } = require('express-validator');
const ctrl = require('../controllers/incidentController');
const { validate } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.get('/:id/audit', authenticate, authorize('moderator', 'admin'), ctrl.getAuditLog);

router.post('/',
  authenticate,
  authorize('moderator', 'admin'),
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('type').isIn(['closure','delay','accident','weather_hazard','military_operation','road_damage','other']),
  body('severity').optional().isIn(['low','medium','high','critical']),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  validate,
  ctrl.create
);

router.patch('/:id',
  authenticate,
  authorize('moderator', 'admin'),
  body('status').optional().isIn(['active','verified','resolved','closed']),
  body('severity').optional().isIn(['low','medium','high','critical']),
  validate,
  ctrl.update
);

router.delete('/:id', authenticate, authorize('admin'), ctrl.delete);

module.exports = router;
