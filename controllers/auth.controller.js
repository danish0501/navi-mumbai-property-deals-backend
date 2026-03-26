'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middlewares/upload.middleware');

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '7d';

// Helper
const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });

const sanitizeUser = (user) => {
  const { password, ...safe } = user;
  return safe;
};

// Register
const register = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Check duplicate email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
        data: null,
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)',
      [fullName, email, phone, hashedPassword]
    );

    const userId = result.insertId;
    const token = signToken(userId, 'user');

    const [rows] = await pool.query(
      'SELECT id, full_name, email, phone, role, avatar_url, created_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { token, user: rows[0] },
    });
  } catch (error) {
    console.error('[Auth] register error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.', data: null });
  }
};

// Login 
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.', data: null });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res
        .status(403)
        .json({ success: false, message: 'Your account has been deactivated. Contact support.', data: null });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.', data: null });
    }

    const token = signToken(user.id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: { token, user: sanitizeUser(user) },
    });
  } catch (error) {
    console.error('[Auth] login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.', data: null });
  }
};

// Get Me 
const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, email, phone, role, avatar_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.', data: null });
    }
    return res.status(200).json({ success: true, message: 'User fetched.', data: rows[0] });
  } catch (error) {
    console.error('[Auth] getMe error:', error);
    return res.status(500).json({ success: false, message: 'Server error.', data: null });
  }
};

// Update Profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    const userId = req.user.id;

    let avatarUrl = null;
    let avatarPublicId = null;

    if (req.file) {
      // Delete old avatar if exists
      if (req.user.avatar_public_id) {
        await deleteFromCloudinary(req.user.avatar_public_id);
      }
      const uploaded = await uploadToCloudinary(req.file.buffer, 'nmpd/avatars');
      avatarUrl = uploaded.url;
      avatarPublicId = uploaded.public_id;
    }

    const updates = [];
    const params = [];

    if (fullName) { updates.push('full_name = ?'); params.push(fullName); }
    if (phone)    { updates.push('phone = ?');     params.push(phone); }
    if (avatarUrl) {
      updates.push('avatar_url = ?');
      updates.push('avatar_public_id = ?');
      params.push(avatarUrl, avatarPublicId);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update.', data: null });
    }

    params.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.query(
      'SELECT id, full_name, email, phone, role, avatar_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    return res.status(200).json({ success: true, message: 'Profile updated.', data: rows[0] });
  } catch (error) {
    console.error('[Auth] updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Server error.', data: null });
  }
};

// Change Password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const [rows] = await pool.query('SELECT password FROM users WHERE id = ? LIMIT 1', [userId]);
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.', data: null });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

    return res.status(200).json({ success: true, message: 'Password changed successfully.', data: null });
  } catch (error) {
    console.error('[Auth] changePassword error:', error);
    return res.status(500).json({ success: false, message: 'Server error.', data: null });
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };
