'use strict';
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { submitInquiry, getInquiries, updateInquiryStatus, subscribe } = require('../controllers/contact.controller');
const { protect, adminOnly } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');

// Public
router.post(
  '/inquiry',
  [
    body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 150 }),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('phone')
      .optional()
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Enter a valid 10-digit Indian mobile number.'),
    body('message').trim().notEmpty().withMessage('Message is required.').isLength({ max: 2000 }),
    body('enquiryType').optional().isLength({ max: 100 }),
  ],
  validate,
  submitInquiry
);

router.post(
  '/subscribe',
  [body('email').isEmail().normalizeEmail().withMessage('A valid email is required.')],
  validate,
  subscribe
);

// Admin
router.get('/inquiries', protect, adminOnly, getInquiries);

router.patch(
  '/inquiries/:id/status',
  protect,
  adminOnly,
  [
    body('status')
      .isIn(['new', 'in-progress', 'resolved'])
      .withMessage("Status must be 'new', 'in-progress', or 'resolved'."),
  ],
  validate,
  updateInquiryStatus
);

module.exports = router;
