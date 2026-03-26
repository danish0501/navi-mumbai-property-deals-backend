'use strict';

const Contact = require('../models/contact.model');

// Submit Inquiry
const submitInquiry = async (req, res) => {
  try {
    const { name, email, phone, enquiryType, message } = req.body;
    const id = await Contact.createInquiry({ name, email, phone, enquiry_type: enquiryType, message });
    return res.status(201).json({ success: true, message: "Thank you! Inquiry received.", data: { id } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to submit.' });
  }
};

// Get All
const getInquiries = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const { inquiries, total } = await Contact.findInquiries({ where, params, limit, offset });
    return res.status(200).json({ success: true, data: { inquiries, pagination: { total, page: Number(page), totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

// Update Status
const updateInquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['new', 'in-progress', 'resolved'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    await Contact.updateInquiryStatus(id, status);
    return res.status(200).json({ success: true, message: 'Status updated.' });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

// Subscribe
const subscribe = async (req, res) => {
  try {
    const { email } = req.body;
    const existing = await Contact.findSubscriber(email);

    if (existing) {
      if (existing.is_active) return res.status(409).json({ success: false, message: 'Already subscribed.' });
      await Contact.updateSubscriberStatus(email, true);
      return res.status(200).json({ success: true, message: 'Resubscribed!' });
    }

    await Contact.addSubscriber(email);
    return res.status(201).json({ success: true, message: 'Subscribed!' });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

module.exports = { submitInquiry, getInquiries, updateInquiryStatus, subscribe };

