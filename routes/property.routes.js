'use strict';
const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const {
  createProperty, getProperties, getPropertyBySlug, getPropertyById,
  updateProperty, deleteProperty, deletePropertyImage, setCoverImage,
} = require('../controllers/property.controller');
const { protect, adminOnly } = require('../middlewares/auth.middleware');
const { upload, handleMulterError } = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');

// Validators
const propertyBodyValidators = [
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 300 }),
  body('purpose').isIn(['sell', 'rent']).withMessage("Purpose must be 'sell' or 'rent'."),
  body('propertyType')
    .isIn(['residential', 'commercial', 'plot', 'paying-guest'])
    .withMessage('Invalid property type.'),
  body('postedBy').isIn(['owner', 'agent', 'builder']).withMessage('Invalid posted-by value.'),
  body('address').trim().notEmpty().withMessage('Address is required.'),
  body('location').trim().notEmpty().withMessage('Location is required.').isLength({ max: 200 }),
  body('price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
  body('rentPrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Rent price must be a positive number.'),
  body('area').optional({ nullable: true }).isFloat({ min: 0 }),
  body('furnishing')
    .optional()
    .isIn(['unfurnished', 'semi-furnished', 'furnished'])
    .withMessage('Invalid furnishing value.'),
  body('constructionStatus')
    .optional()
    .isIn(['ready-to-move', 'under-construction', 'new-launch'])
    .withMessage('Invalid construction status.'),
  body('age').optional().isIn(['0-1', '1-5', '5-10', '10+']).withMessage('Invalid age range.'),
];

// Public Routes
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
  ],
  validate,
  getProperties
);

router.get('/slug/:slug', getPropertyBySlug);
router.get('/:id', [param('id').isInt({ min: 1 })], validate, getPropertyById);

// Protected Routes
router.post(
  '/',
  protect,
  upload.array('images', 15),
  handleMulterError,
  propertyBodyValidators,
  validate,
  createProperty
);

router.put(
  '/:id',
  protect,
  upload.array('images', 15),
  handleMulterError,
  [param('id').isInt({ min: 1 }), ...propertyBodyValidators.map((v) => v.optional())],
  validate,
  updateProperty
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  [param('id').isInt({ min: 1 })],
  validate,
  deleteProperty
);

router.delete(
  '/:propertyId/images/:imageId',
  protect,
  [param('propertyId').isInt({ min: 1 }), param('imageId').isInt({ min: 1 })],
  validate,
  deletePropertyImage
);

router.patch(
  '/:propertyId/images/:imageId/cover',
  protect,
  [param('propertyId').isInt({ min: 1 }), param('imageId').isInt({ min: 1 })],
  validate,
  setCoverImage
);

module.exports = router;
