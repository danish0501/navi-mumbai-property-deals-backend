'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
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

    const exists = await User.isEmailTaken(email);
    if (exists) {
      return res.status(409).json({ success: false, message: 'Email already exists.', data: null });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = await User.create({ fullName, email, phone, password: hashedPassword });

    const user = await User.findById(userId);
    const token = signToken(userId, 'user');

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { token, user },
    });
  } catch (error) {
    console.error('[Auth] register error:', error);
    return res.status(500).json({ success: false, message: 'Server error.', data: null });
  }
};

// Login 
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user || !user.is_active) {
      const msg = !user ? 'Invalid email or password.' : 'Account deactivated.';
      return res.status(401).json({ success: false, message: msg, data: null });
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
    return res.status(500).json({ success: false, message: 'Server error.', data: null });
  }
};

// Get Me 
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.', data: null });
    return res.status(200).json({ success: true, message: 'User fetched.', data: user });
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
    const updates = {};

    if (fullName) updates.full_name = fullName;
    if (phone) updates.phone = phone;

    if (req.file) {
      if (req.user.avatar_public_id) await deleteFromCloudinary(req.user.avatar_public_id);
      const uploaded = await uploadToCloudinary(req.file.buffer, 'nmpd/avatars');
      updates.avatar_url = uploaded.url;
      updates.avatar_public_id = uploaded.public_id;
    }

    if (Object.keys(updates).length > 0) {
      await User.update(userId, updates);
    }

    const user = await User.findById(userId);
    return res.status(200).json({ success: true, message: 'Profile updated.', data: user });
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

    const user = await User.findByEmail(req.user.email);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password incorrect.', data: null });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await User.update(userId, { password: hashed });

    return res.status(200).json({ success: true, message: 'Password changed.', data: null });
  } catch (error) {
    console.error('[Auth] changePassword error:', error);
    return res.status(500).json({ success: false, message: 'Server error.', data: null });
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };
