'use strict';
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

/**
 * Protect a route — requires a valid Bearer JWT in the Authorization header.
 * Attaches `req.user` on success.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        data: null,
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      'SELECT id, full_name, email, phone, role, avatar_url, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account deactivated.',
        data: null,
      });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Token has expired. Please login again.'
        : 'Invalid token.';
    return res.status(401).json({ success: false, message, data: null });
  }
};

/**
 * Restrict access to admin-only routes.
 * Must be used AFTER `protect`.
 */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Admins only.',
      data: null,
    });
  }
  next();
};

module.exports = { protect, adminOnly };
