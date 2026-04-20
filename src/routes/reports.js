const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/reportController');
const { validate } = require('../middleware/errorHandler');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

router.post('/',
  optionalAuth,
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('category').isIn(['checkpoint_closure','delay','road_damage','hazard','protest','military','other']),
  body('description').trim().notEmpty().isLength({ min: 10, max: 1000 }),
  validate,
  ctrl.submit
);

router.post('/:id/vote',
  authenticate,
  body('vote').isIn([1, -1]),
  validate,
  ctrl.vote
);

router.patch('/:id/moderate',
  authenticate,
  authorize('moderator', 'admin'),
  body('status').isIn(['verified','rejected','duplicate']),
  validate,
  ctrl.moderate
);

module.exports = router;
