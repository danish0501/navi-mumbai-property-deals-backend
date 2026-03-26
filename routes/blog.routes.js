'use strict';
const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const { createBlog, getBlogs, getBlogBySlug, updateBlog, deleteBlog } = require('../controllers/blog.controller');
const { protect, adminOnly } = require('../middlewares/auth.middleware');
const { upload, handleMulterError } = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');

// Public Routes
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('status').optional().isIn(['draft', 'published']),
  ],
  validate,
  getBlogs
);

router.get('/slug/:slug', getBlogBySlug);

// Admin-only Routes
router.post(
  '/',
  protect,
  adminOnly,
  upload.single('coverImage'),
  handleMulterError,
  [
    body('title').trim().notEmpty().withMessage('Blog title is required.').isLength({ max: 350 }),
    body('content').notEmpty().withMessage('Blog content is required.'),
    body('category').trim().notEmpty().withMessage('Category is required.').isLength({ max: 100 }),
    body('authorName').trim().notEmpty().withMessage('Author name is required.').isLength({ max: 150 }),
    body('status').optional().isIn(['draft', 'published']).withMessage("Status must be 'draft' or 'published'."),
    body('tags').optional(),
  ],
  validate,
  createBlog
);

router.put(
  '/:id',
  protect,
  adminOnly,
  upload.single('coverImage'),
  handleMulterError,
  [
    param('id').isInt({ min: 1 }),
    body('title').optional().trim().notEmpty().isLength({ max: 350 }),
    body('content').optional().notEmpty(),
    body('category').optional().trim().notEmpty().isLength({ max: 100 }),
    body('authorName').optional().trim().notEmpty().isLength({ max: 150 }),
    body('status').optional().isIn(['draft', 'published']),
  ],
  validate,
  updateBlog
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  [param('id').isInt({ min: 1 })],
  validate,
  deleteBlog
);

module.exports = router;
