'use strict';
const { pool } = require('../config/db');

// Submit Contact Inquiry
const submitInquiry = async (req, res) => {
  try {
    const { name, email, phone, enquiryType, message } = req.body;

    const [result] = await pool.query(
      'INSERT INTO contact_inquiries (name, email, phone, enquiry_type, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || null, enquiryType || null, message]
    );

    const [rows] = await pool.query(
      'SELECT * FROM contact_inquiries WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Thank you! We've received your inquiry and will get back to you soon.",
      data: rows[0],
    });
  } catch (error) {
    console.error('[Contact] submitInquiry error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit inquiry.', data: null });
  }
};

// Get All Inquiries (admin)
const getInquiries = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const conditions = [];
    const params = [];

    if (status) { conditions.push('status = ?'); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM contact_inquiries ${where}`,
      params
    );

    const [inquiries] = await pool.query(
      `SELECT * FROM contact_inquiries ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    return res.status(200).json({
      success: true,
      message: 'Inquiries fetched.',
      data: {
        inquiries,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('[Contact] getInquiries error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inquiries.', data: null });
  }
};

// Update Inquiry Status
const updateInquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['new', 'in-progress', 'resolved'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(', ')}`,
        data: null,
      });
    }

    const [result] = await pool.query(
      'UPDATE contact_inquiries SET status = ? WHERE id = ?',
      [status, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.', data: null });
    }

    const [rows] = await pool.query('SELECT * FROM contact_inquiries WHERE id = ? LIMIT 1', [id]);
    return res.status(200).json({ success: true, message: 'Inquiry status updated.', data: rows[0] });
  } catch (error) {
    console.error('[Contact] updateInquiryStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update inquiry.', data: null });
  }
};

// Newsletter Subscribe
const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    const [existing] = await pool.query(
      'SELECT id, is_active FROM newsletter_subscribers WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length) {
      if (existing[0].is_active) {
        return res.status(409).json({
          success: false,
          message: 'This email is already subscribed.',
          data: null,
        });
      }
      // Re-activate
      await pool.query('UPDATE newsletter_subscribers SET is_active = 1 WHERE email = ?', [email]);
      return res.status(200).json({ success: true, message: 'Successfully resubscribed!', data: { email } });
    }

    await pool.query('INSERT INTO newsletter_subscribers (email) VALUES (?)', [email]);
    return res.status(201).json({ success: true, message: 'Successfully subscribed to our newsletter!', data: { email } });
  } catch (error) {
    console.error('[Contact] subscribe error:', error);
    return res.status(500).json({ success: false, message: 'Failed to subscribe.', data: null });
  }
};

module.exports = { submitInquiry, getInquiries, updateInquiryStatus, subscribe };
