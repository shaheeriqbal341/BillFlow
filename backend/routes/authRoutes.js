const express = require('express');
const { register, login, adminLogin, logout, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

router.post('/register', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { forwardedHeader: false },
}), register);
router.post('/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { forwardedHeader: false },
}), login);
router.post(
  '/admin/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { forwardedHeader: false },
  }),
  adminLogin,
);
router.post('/logout', logout);
router.get('/me', protect, getProfile);

module.exports = router;
