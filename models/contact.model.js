'use strict';

const { pool } = require('../config/db');

const Contact = {
  /** Submit new inquiry **/
  async createInquiry(data) {
    const { name, email, phone, enquiry_type, message } = data;
    const [result] = await pool.query(
      'INSERT INTO contact_inquiries (name, email, phone, enquiry_type, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, enquiry_type, message]
    );
    return result.insertId;
  },

  /** List inquiries **/
  async findInquiries({ where, params, limit, offset }) {
    const [inquiries] = await pool.query(
      `SELECT * FROM contact_inquiries ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM contact_inquiries ${where}`, params);
    return { inquiries, total };
  },

  /** Newsletter subscribe/check **/
  async findSubscriber(email) {
    const [rows] = await pool.query('SELECT * FROM newsletter_subscribers WHERE email = ? LIMIT 1', [email]);
    return rows.length > 0 ? rows[0] : null;
  },

  async addSubscriber(email) {
    await pool.query('INSERT INTO newsletter_subscribers (email) VALUES (?)', [email]);
  },

  async updateSubscriberStatus(email, status) {
    await pool.query('UPDATE newsletter_subscribers SET is_active = ? WHERE email = ?', [status ? 1 : 0, email]);
  },

  async updateInquiryStatus(id, status) {
    await pool.query('UPDATE contact_inquiries SET status = ? WHERE id = ?', [status, id]);
  }
};

module.exports = Contact;
