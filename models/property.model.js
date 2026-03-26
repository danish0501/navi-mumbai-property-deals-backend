'use strict';

const { pool } = require('../config/db');

const Property = {
  /** Create a property listing (transaction handled in controller) **/
  async create(conn, propertyData) {
    const {
      slug, title, purpose, property_type, configuration, config_details, posted_by, user_id,
      price, price_type, price_per_sqft, rent_price, security_deposit, maintenance,
      is_rera_verified, rera_number, address, location, area, furnishing, facing,
      floor, total_floors, parking, construction_status, age, suitable_for,
      available_from, description
    } = propertyData;

    const [result] = await conn.query(
      `INSERT INTO properties 
        (slug, title, purpose, property_type, configuration, config_details, posted_by, user_id,
         price, price_type, price_per_sqft, rent_price, security_deposit, maintenance,
         is_rera_verified, rera_number, address, location, area, furnishing, facing,
         floor, total_floors, parking, construction_status, age,
         suitable_for, available_from, description)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        slug, title, purpose, property_type, configuration, config_details, posted_by, user_id,
        price, price_type, price_per_sqft, rent_price, security_deposit, maintenance,
        is_rera_verified, rera_number, address, location, area, furnishing, facing,
        floor, total_floors, parking, construction_status, age, 
        suitable_for, available_from, description
      ]
    );
    return result.insertId;
  },

  /** Find a property by Slug or ID **/
  async findOne(filter) {
    const key = filter.slug ? 'slug' : 'id';
    const val = filter.slug || filter.id;
    const [rows] = await pool.query(`SELECT * FROM properties WHERE ${key} = ? LIMIT 1`, [val]);
    return rows.length > 0 ? rows[0] : null;
  },

  /** Paginated listing with dynamic filters **/
  async findAll({ where, params, sort, order, limit, offset }) {
    const [properties] = await pool.query(
      `SELECT p.*, 
        (SELECT url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) AS cover_image
       FROM properties p
       WHERE ${where}
       ORDER BY p.${sort} ${order}
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM properties p WHERE ${where}`,
      params
    );

    return { properties, total };
  },

  /** Update property (transaction handled in controller) **/
  async update(conn, id, updateMap) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateMap)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    if (fields.length === 0) return;
    params.push(id);
    await conn.query(`UPDATE properties SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  /** Delete property records **/
  async delete(id) {
    await pool.query('DELETE FROM properties WHERE id = ?', [id]);
  },

  /** Relations (Images, Amenities, etc) **/
  async addImages(conn, rows) {
    await conn.query(
      'INSERT INTO property_images (property_id, url, public_id, is_cover, sort_order) VALUES ?',
      [rows]
    );
  },

  async addAmenities(conn, rows) {
    await conn.query('INSERT INTO property_amenities (property_id, amenity) VALUES ?', [rows]);
  },

  async addFeatures(conn, rows) {
    await conn.query('INSERT INTO property_features (property_id, feature) VALUES ?', [rows]);
  },

  async addNearbyPlaces(conn, rows) {
    await conn.query(
      'INSERT INTO property_nearby_places (property_id, name, distance, category) VALUES ?',
      [rows]
    );
  }
};

module.exports = Property;
