'use strict';
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { register, login, getMe, updateProfile, changePassword } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { upload, handleMulterError } = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');

// Register 
router.post(
  '/register',
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 150 }),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required.')
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Enter a valid 10-digit Indian mobile number.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain an uppercase letter, a lowercase letter, and a number.'),
  ],
  validate,
  register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  login
);

// Protected
router.get('/me', protect, getMe);

router.put(
  '/profile',
  protect,
  upload.single('avatar'),
  handleMulterError,
  [
    body('fullName').optional().trim().notEmpty().isLength({ max: 150 }),
    body('phone')
      .optional()
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Enter a valid 10-digit Indian mobile number.'),
  ],
  validate,
  updateProfile
);

router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters.')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain an uppercase letter, a lowercase letter, and a number.'),
  ],
  validate,
  changePassword
);

module.exports = router;
