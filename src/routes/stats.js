const router = require('express').Router();
const ctrl = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/overview', ctrl.overview);
router.get('/checkpoints', ctrl.checkpointStats);
router.get('/reports', authenticate, authorize('moderator', 'admin'), ctrl.reportStats);

module.exports = router;