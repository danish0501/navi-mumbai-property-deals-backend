'use strict';

const { pool } = require('../config/db');

const User = {
  /**
   * Find a user by email.
   * @param {string} email 
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Find a user by ID.
   * @param {number} id 
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT id, full_name, email, phone, role, avatar_url, is_active, created_at FROM users WHERE id = ? LIMIT 1',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create a new user account.
   * @param {object} userData {fullName, email, phone, password}
   * @returns {Promise<number>} New user ID
   */
  async create({ fullName, email, phone, password }) {
    try {
      const [result] = await pool.query(
        'INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)',
        [fullName, email, phone, password]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update user details.
   * @param {number} userId 
   * @param {object} updates 
   */
  async update(userId, updates) {
    try {
      const fields = [];
      const params = [];

      for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }

      if (fields.length === 0) return;

      params.push(userId);
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Check if an email is already taken.
   * @param {string} email 
   * @returns {Promise<boolean>}
   */
  async isEmailTaken(email) {
    try {
      const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      return rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = User;
