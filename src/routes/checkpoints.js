const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/checkpointController');
const { validate } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.get('/:id/history', ctrl.getStatusHistory);

router.post('/',
  authenticate,
  authorize('moderator', 'admin'),
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('type').optional().isIn(['military','police','flying','crossing','other']),
  validate,
  ctrl.create
);

router.post('/:id/status',
  authenticate,
  body('status').isIn(['open','closed','restricted','delayed','unknown']),
  validate,
  ctrl.updateStatus
);

module.exports = router;
