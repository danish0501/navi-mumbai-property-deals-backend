'use strict';
const slugify = require('./slugify');
const { pool } = require('../config/db');

/**
 * Generate a URL-friendly slug from a string.
 * Appends a random 6-character hex suffix to ensure uniqueness per table.
 *
 * @param {string} title - Source text
 * @param {string} table - Table name to check for existing slugs
 * @param {string} [column='slug'] - Column name to check
 * @returns {Promise<string>} Unique slug
 */
const generateUniqueSlug = async (title, table, column = 'slug') => {
  const base = slugify(title);

  // Try the base slug first, then suffix with random hex
  const candidates = [
    base,
    ...Array.from({ length: 5 }, () => `${base}-${Math.random().toString(16).slice(2, 8)}`),
  ];

  for (const candidate of candidates) {
    const [rows] = await pool.query(
      `SELECT id FROM \`${table}\` WHERE \`${column}\` = ? LIMIT 1`,
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }

  // Last-resort: timestamp suffix
  return `${base}-${Date.now()}`;
};

module.exports = generateUniqueSlug;
