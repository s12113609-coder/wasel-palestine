const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const { validate } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

router.post('/register',
  body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/),
  validate,
  ctrl.register
);

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  ctrl.login
);

router.post('/refresh',
  body('refreshToken').notEmpty(),
  validate,
  ctrl.refresh
);

router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
