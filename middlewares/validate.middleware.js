'use strict';
const { validationResult } = require('express-validator');

/**
 * Middleware that reads express-validator results and responds with 422 if
 * any validations failed.  Place after your validator chain.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      data: { errors: errors.array() },
    });
  }
  next();
};

module.exports = validate;
