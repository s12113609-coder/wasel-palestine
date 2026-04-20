const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/alertController');
const { validate } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/subscriptions', ctrl.listSubscriptions);
router.post('/subscriptions',
  body('region').optional().trim().notEmpty(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('radius_km').optional().isFloat({ min: 1, max: 200 }),
  body('categories').optional().isArray(),
  validate,
  ctrl.subscribe
);
router.delete('/subscriptions/:id', ctrl.deleteSubscription);

router.get('/', ctrl.listAlerts);
router.patch('/:id/read', ctrl.markRead);

module.exports = router;
