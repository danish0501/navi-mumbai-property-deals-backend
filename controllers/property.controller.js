'use strict';

const { pool } = require('../config/db');
const Property = require('../models/property.model');
const generateUniqueSlug = require('../utils/generateSlug');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middlewares/upload.middleware');

// Helpers
const fetchPropertyRelations = async (id) => {
  const [[images], [amenities], [features], [nearby]] = await Promise.all([
    pool.query('SELECT id, url, public_id, is_cover FROM property_images WHERE property_id=? ORDER BY sort_order', [id]),
    pool.query('SELECT amenity FROM property_amenities WHERE property_id=?', [id]),
    pool.query('SELECT feature FROM property_features WHERE property_id=?', [id]),
    pool.query('SELECT name, distance, category FROM property_nearby_places WHERE property_id=?', [id]),
  ]);
  return { images, amenities: amenities.map(r => r.amenity), features: features.map(r => r.feature), nearbyPlaces: nearby };
};

// Create Property
const createProperty = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const slug = await generateUniqueSlug(req.body.title, 'properties');

    const propId = await Property.create(conn, {
      ...req.body, slug, user_id: req.user?.id,
      is_rera_verified: req.body.isReraVerified ? 1 : 0,
      suitable_for: Array.isArray(req.body.suitableFor) ? req.body.suitableFor.join(',') : req.body.suitableFor,
      property_type: req.body.propertyType, posted_by: req.body.postedBy,
      price: req.body.price, price_type: req.body.priceType, price_per_sqft: req.body.pricePerSqft,
      rent_price: req.body.rentPrice, security_deposit: req.body.securityDeposit,
      config_details: req.body.configDetails, total_floors: req.body.totalFloors,
      construction_status: req.body.constructionStatus, available_from: req.body.availableFrom
    });

    const amenities = Array.isArray(req.body.amenities) ? req.body.amenities : JSON.parse(req.body.amenities || '[]');
    const features = Array.isArray(req.body.features) ? req.body.features : JSON.parse(req.body.features || '[]');
    const nearby = Array.isArray(req.body.nearbyPlaces) ? req.body.nearbyPlaces : JSON.parse(req.body.nearbyPlaces || '[]');

    if (amenities.length) await Property.addAmenities(conn, amenities.map(a => [propId, a]));
    if (features.length) await Property.addFeatures(conn, features.map(f => [propId, f]));
    if (nearby.length) await Property.addNearbyPlaces(conn, nearby.map(n => [propId, n.name, n.distance, n.category]));

    if (req.files?.length) {
      const uploads = await Promise.all(req.files.map(f => uploadToCloudinary(f.buffer, 'nmpd/properties')));
      await Property.addImages(conn, uploads.map((u, i) => [propId, u.url, u.public_id, i === 0 ? 1 : 0, i]));
    }

    await conn.commit();
    const property = await Property.findOne({ id: propId });
    const relations = await fetchPropertyRelations(propId);
    return res.status(201).json({ success: true, message: 'Property created.', data: { ...property, ...relations } });
  } catch (error) {
    await conn.rollback();
    console.error('[Property] create error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create.', data: null });
  } finally {
    conn.release();
  }
};

// Get All
const getProperties = async (req, res) => {
  try {
    const { purpose, propertyType, location, minPrice, maxPrice, furnishing, status='active', page=1, limit=12 } = req.query;
    const conditions = ["p.status = ?"];
    const params = [status];

    if (purpose) { conditions.push('p.purpose = ?'); params.push(purpose); }
    if (propertyType) { conditions.push('p.property_type = ?'); params.push(propertyType); }
    if (location) { conditions.push('p.location LIKE ?'); params.push(`%${location}%`); }
    if (minPrice) { conditions.push('(p.price >= ? OR p.rent_price >= ?)'); params.push(Number(minPrice), Number(minPrice)); }
    if (maxPrice) { conditions.push('(p.price <= ? OR p.rent_price <= ?)'); params.push(Number(maxPrice), Number(maxPrice)); }

    const offset = (Number(page) - 1) * Number(limit);
    const { properties, total } = await Property.findAll({ where: conditions.join(' AND '), params, sort: 'created_at', order: 'DESC', limit, offset });

    return res.status(200).json({ success: true, data: { properties, pagination: { total, page: Number(page), totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Fetch failed.' });
  }
};

// Get One
const getPropertyBySlug = async (req, res) => {
  try {
    const property = await Property.findOne({ slug: req.params.slug });
    if (!property) return res.status(404).json({ success: false, message: 'Not found.' });
    pool.query('UPDATE properties SET views = views + 1 WHERE id = ?', [property.id]);
    const relations = await fetchPropertyRelations(property.id);
    return res.status(200).json({ success: true, data: { ...property, ...relations } });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findOne({ id: req.params.id });
    if (!property) return res.status(404).json({ success: false, message: 'Not found.' });
    const relations = await fetchPropertyRelations(property.id);
    return res.status(200).json({ success: true, data: { ...property, ...relations } });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

// Update
const updateProperty = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = req.params.id;
    const updates = { ...req.body };
    if (req.body.propertyType) updates.property_type = req.body.propertyType;
    if (req.body.isReraVerified !== undefined) updates.is_rera_verified = req.body.isReraVerified ? 1 : 0;

    await Property.update(conn, id, updates);

    if (req.body.amenities) {
      await conn.query('DELETE FROM property_amenities WHERE property_id=?', [id]);
      const arr = Array.isArray(req.body.amenities) ? req.body.amenities : JSON.parse(req.body.amenities);
      if (arr.length) await Property.addAmenities(conn, arr.map(a => [id, a]));
    }

    if (req.files?.length) {
      const uploads = await Promise.all(req.files.map(f => uploadToCloudinary(f.buffer, 'nmpd/properties')));
      await Property.addImages(conn, uploads.map((u, i) => [id, u.url, u.public_id, 0, 99 + i]));
    }

    await conn.commit();
    return res.status(200).json({ success: true, message: 'Updated.' });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ success: false });
  } finally {
    conn.release();
  }
};

// Delete
const deleteProperty = async (req, res) => {
  try {
    const [images] = await pool.query('SELECT public_id FROM property_images WHERE property_id=?', [req.params.id]);
    await Promise.allSettled(images.map(img => deleteFromCloudinary(img.public_id)));
    await Property.delete(req.params.id);
    return res.status(200).json({ success: true, message: 'Deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

const setCoverImage = async (req, res) => {
  try {
    const { propertyId, imageId } = req.params;
    await pool.query('UPDATE property_images SET is_cover = 0 WHERE property_id = ?', [propertyId]);
    await pool.query('UPDATE property_images SET is_cover = 1 WHERE id = ? AND property_id = ?', [imageId, propertyId]);
    return res.status(200).json({ success: true, message: 'Cover set.' });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

module.exports = { createProperty, getProperties, getPropertyBySlug, getPropertyById, updateProperty, deleteProperty, setCoverImage };
