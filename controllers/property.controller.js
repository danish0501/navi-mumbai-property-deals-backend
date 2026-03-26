'use strict';
const { pool } = require('../config/db');
const generateUniqueSlug = require('../utils/generateSlug');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middlewares/upload.middleware');

// Helpers

/** Fetch all sub-items for a property in one shot via parallel queries **/
const fetchPropertyRelations = async (propertyId) => {
  const [[images], [amenities], [features], [nearby]] = await Promise.all([
    pool.query(
      'SELECT id, url, public_id, is_cover, sort_order FROM property_images WHERE property_id = ? ORDER BY sort_order ASC',
      [propertyId]
    ),
    pool.query('SELECT amenity FROM property_amenities WHERE property_id = ?', [propertyId]),
    pool.query('SELECT feature FROM property_features WHERE property_id = ?', [propertyId]),
    pool.query(
      'SELECT name, distance, category FROM property_nearby_places WHERE property_id = ?',
      [propertyId]
    ),
  ]);

  return {
    images,
    amenities: amenities.map((r) => r.amenity),
    features: features.map((r) => r.feature),
    nearbyPlaces: nearby,
  };
};

/** Insert amenities, features, and nearby places for a property inside a provided DB connection (for transaction support) **/
const insertRelations = async (conn, propertyId, { amenities, features, nearbyPlaces }) => {
  if (amenities?.length) {
    const rows = amenities.map((a) => [propertyId, a]);
    await conn.query('INSERT INTO property_amenities (property_id, amenity) VALUES ?', [rows]);
  }
  if (features?.length) {
    const rows = features.map((f) => [propertyId, f]);
    await conn.query('INSERT INTO property_features (property_id, feature) VALUES ?', [rows]);
  }
  if (nearbyPlaces?.length) {
    const rows = nearbyPlaces.map(({ name, distance, category }) => [propertyId, name, distance, category]);
    await conn.query(
      'INSERT INTO property_nearby_places (property_id, name, distance, category) VALUES ?',
      [rows]
    );
  }
};

// Create Property
const createProperty = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      title, purpose, propertyType, configuration, configDetails, postedBy,
      price, priceType, pricePerSqft, rentPrice, securityDeposit, maintenance,
      isReraVerified, reraNumber, address, location, area, furnishing, facing,
      floor, totalFloors, parking, constructionStatus, age, amenities, features,
      nearbyPlaces, suitableFor, availableFrom, description,
    } = req.body;

    const slug = await generateUniqueSlug(title, 'properties');

    const [result] = await conn.query(
      `INSERT INTO properties
        (slug, title, purpose, property_type, configuration, config_details, posted_by, user_id,
         price, price_type, price_per_sqft, rent_price, security_deposit, maintenance,
         is_rera_verified, rera_number, address, location, area, furnishing, facing,
         floor, total_floors, parking, construction_status, age,
         suitable_for, available_from, description)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        slug, title, purpose, propertyType, configuration || null, configDetails || null, postedBy,
        req.user?.id || null,
        price || null, priceType || 'fixed', pricePerSqft || null,
        rentPrice || null, securityDeposit || null, maintenance || null,
        isReraVerified ? 1 : 0, reraNumber || null,
        address, location,
        area || null, furnishing || null, facing || null,
        floor || null, totalFloors || null, parking || null,
        constructionStatus || null, age || null,
        Array.isArray(suitableFor) ? suitableFor.join(',') : (suitableFor || null),
        availableFrom || null,
        description || null,
      ]
    );

    const propertyId = result.insertId;

    // Insert relations
    const amenitiesArr = Array.isArray(amenities) ? amenities : JSON.parse(amenities || '[]');
    const featuresArr  = Array.isArray(features)  ? features  : JSON.parse(features  || '[]');
    const nearbyArr    = Array.isArray(nearbyPlaces) ? nearbyPlaces : JSON.parse(nearbyPlaces || '[]');

    await insertRelations(conn, propertyId, {
      amenities: amenitiesArr,
      features: featuresArr,
      nearbyPlaces: nearbyArr,
    });

    // Upload images
    if (req.files?.length) {
      const uploads = await Promise.all(
        req.files.map((file) => uploadToCloudinary(file.buffer, 'nmpd/properties'))
      );
      const imageRows = uploads.map((img, idx) => [
        propertyId, img.url, img.public_id, idx === 0 ? 1 : 0, idx,
      ]);
      await conn.query(
        'INSERT INTO property_images (property_id, url, public_id, is_cover, sort_order) VALUES ?',
        [imageRows]
      );
    }

    await conn.commit();

    const [props] = await pool.query('SELECT * FROM properties WHERE id = ? LIMIT 1', [propertyId]);
    const relations = await fetchPropertyRelations(propertyId);

    return res.status(201).json({
      success: true,
      message: 'Property listed successfully.',
      data: { ...props[0], ...relations },
    });
  } catch (error) {
    await conn.rollback();
    console.error('[Property] createProperty error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create property.', data: null });
  } finally {
    conn.release();
  }
};

// Get All Properties (with filters + pagination)
const getProperties = async (req, res) => {
  try {
    const {
      purpose, propertyType, location, minPrice, maxPrice,
      furnishing, isReraVerified, constructionStatus,
      sortBy = 'created_at', order = 'DESC',
      page = 1, limit = 12,
    } = req.query;

    const allowedSorts = ['created_at', 'price', 'rent_price', 'area', 'views'];
    const safeSort  = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions = ["p.status = 'active'"];
    const params = [];

    if (purpose)            { conditions.push('p.purpose = ?');             params.push(purpose); }
    if (propertyType)       { conditions.push('p.property_type = ?');       params.push(propertyType); }
    if (location)           { conditions.push('p.location LIKE ?');          params.push(`%${location}%`); }
    if (furnishing)         { conditions.push('p.furnishing = ?');           params.push(furnishing); }
    if (constructionStatus) { conditions.push('p.construction_status = ?'); params.push(constructionStatus); }
    if (isReraVerified !== undefined) {
      conditions.push('p.is_rera_verified = ?');
      params.push(isReraVerified === 'true' ? 1 : 0);
    }

    // Price filter covers both sell (price) and rent (rent_price)
    if (minPrice) {
      conditions.push('(p.price >= ? OR p.rent_price >= ?)');
      params.push(Number(minPrice), Number(minPrice));
    }
    if (maxPrice) {
      conditions.push('(p.price <= ? OR p.rent_price <= ?)');
      params.push(Number(maxPrice), Number(maxPrice));
    }

    const where = conditions.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM properties p WHERE ${where}`,
      params
    );

    const [properties] = await pool.query(
      `SELECT p.*,
        (SELECT url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) AS cover_image
       FROM properties p
       WHERE ${where}
       ORDER BY p.${safeSort} ${safeOrder}
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    return res.status(200).json({
      success: true,
      message: 'Properties fetched.',
      data: {
        properties,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('[Property] getProperties error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch properties.', data: null });
  }
};

// Get Single Property
const getPropertyBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await pool.query('SELECT * FROM properties WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Property not found.', data: null });
    }

    const property = rows[0];
    // Increment views (fire-and-forget)
    pool.query('UPDATE properties SET views = views + 1 WHERE id = ?', [property.id]);

    const relations = await fetchPropertyRelations(property.id);

    return res.status(200).json({
      success: true,
      message: 'Property fetched.',
      data: { ...property, ...relations },
    });
  } catch (error) {
    console.error('[Property] getPropertyBySlug error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch property.', data: null });
  }
};

// Get Property By ID
const getPropertyById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM properties WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Property not found.', data: null });
    }
    const relations = await fetchPropertyRelations(rows[0].id);
    return res.status(200).json({
      success: true,
      message: 'Property fetched.',
      data: { ...rows[0], ...relations },
    });
  } catch (error) {
    console.error('[Property] getPropertyById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch property.', data: null });
  }
};

// Update Property
const updateProperty = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const [existing] = await conn.query('SELECT * FROM properties WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Property not found.', data: null });
    }

    const fields = [
      'title','purpose','property_type','configuration','config_details','posted_by',
      'price','price_type','price_per_sqft','rent_price','security_deposit','maintenance',
      'is_rera_verified','rera_number','address','location','area','furnishing','facing',
      'floor','total_floors','parking','construction_status','age','suitable_for',
      'available_from','description','status',
    ];

    const bodyMap = {
      title: req.body.title, purpose: req.body.purpose, property_type: req.body.propertyType,
      configuration: req.body.configuration, config_details: req.body.configDetails,
      posted_by: req.body.postedBy, price: req.body.price, price_type: req.body.priceType,
      price_per_sqft: req.body.pricePerSqft, rent_price: req.body.rentPrice,
      security_deposit: req.body.securityDeposit, maintenance: req.body.maintenance,
      is_rera_verified: req.body.isReraVerified !== undefined ? (req.body.isReraVerified ? 1 : 0) : undefined,
      rera_number: req.body.reraNumber, address: req.body.address, location: req.body.location,
      area: req.body.area, furnishing: req.body.furnishing, facing: req.body.facing,
      floor: req.body.floor, total_floors: req.body.totalFloors, parking: req.body.parking,
      construction_status: req.body.constructionStatus, age: req.body.age,
      suitable_for: Array.isArray(req.body.suitableFor) ? req.body.suitableFor.join(',') : req.body.suitableFor,
      available_from: req.body.availableFrom, description: req.body.description,
      status: req.body.status,
    };

    const setClauses = [];
    const params = [];
    for (const col of fields) {
      if (bodyMap[col] !== undefined) {
        setClauses.push(`${col} = ?`);
        params.push(bodyMap[col]);
      }
    }

    if (setClauses.length) {
      params.push(id);
      await conn.query(`UPDATE properties SET ${setClauses.join(', ')} WHERE id = ?`, params);
    }

    // Replace relations when provided
    if (req.body.amenities !== undefined) {
      await conn.query('DELETE FROM property_amenities WHERE property_id = ?', [id]);
      const arr = Array.isArray(req.body.amenities) ? req.body.amenities : JSON.parse(req.body.amenities || '[]');
      if (arr.length) await insertRelations(conn, id, { amenities: arr, features: [], nearbyPlaces: [] });
    }
    if (req.body.features !== undefined) {
      await conn.query('DELETE FROM property_features WHERE property_id = ?', [id]);
      const arr = Array.isArray(req.body.features) ? req.body.features : JSON.parse(req.body.features || '[]');
      if (arr.length) await insertRelations(conn, id, { amenities: [], features: arr, nearbyPlaces: [] });
    }
    if (req.body.nearbyPlaces !== undefined) {
      await conn.query('DELETE FROM property_nearby_places WHERE property_id = ?', [id]);
      const arr = Array.isArray(req.body.nearbyPlaces) ? req.body.nearbyPlaces : JSON.parse(req.body.nearbyPlaces || '[]');
      if (arr.length) await insertRelations(conn, id, { amenities: [], features: [], nearbyPlaces: arr });
    }

    // New image uploads
    if (req.files?.length) {
      const uploads = await Promise.all(
        req.files.map((file) => uploadToCloudinary(file.buffer, 'nmpd/properties'))
      );
      const [existing_imgs] = await conn.query(
        'SELECT MAX(sort_order) AS max_order FROM property_images WHERE property_id = ?',
        [id]
      );
      let startOrder = (existing_imgs[0].max_order ?? -1) + 1;
      const imageRows = uploads.map((img, idx) => [
        id, img.url, img.public_id, 0, startOrder + idx,
      ]);
      await conn.query(
        'INSERT INTO property_images (property_id, url, public_id, is_cover, sort_order) VALUES ?',
        [imageRows]
      );
    }

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM properties WHERE id = ? LIMIT 1', [id]);
    const relations = await fetchPropertyRelations(id);

    return res.status(200).json({
      success: true,
      message: 'Property updated.',
      data: { ...updated[0], ...relations },
    });
  } catch (error) {
    await conn.rollback();
    console.error('[Property] updateProperty error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update property.', data: null });
  } finally {
    conn.release();
  }
};

// Delete Property
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id FROM properties WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Property not found.', data: null });
    }

    // Delete Cloudinary images (best-effort)
    const [images] = await pool.query(
      'SELECT public_id FROM property_images WHERE property_id = ?',
      [id]
    );
    await Promise.allSettled(images.map((img) => deleteFromCloudinary(img.public_id)));

    await pool.query('DELETE FROM properties WHERE id = ?', [id]);

    return res.status(200).json({ success: true, message: 'Property deleted.', data: null });
  } catch (error) {
    console.error('[Property] deleteProperty error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete property.', data: null });
  }
};

// Delete a specific property image
const deletePropertyImage = async (req, res) => {
  try {
    const { propertyId, imageId } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM property_images WHERE id = ? AND property_id = ? LIMIT 1',
      [imageId, propertyId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Image not found.', data: null });
    }
    await deleteFromCloudinary(rows[0].public_id);
    await pool.query('DELETE FROM property_images WHERE id = ?', [imageId]);
    return res.status(200).json({ success: true, message: 'Image deleted.', data: null });
  } catch (error) {
    console.error('[Property] deletePropertyImage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete image.', data: null });
  }
};

// Set Cover Image
const setCoverImage = async (req, res) => {
  try {
    const { propertyId, imageId } = req.params;
    await pool.query('UPDATE property_images SET is_cover = 0 WHERE property_id = ?', [propertyId]);
    await pool.query(
      'UPDATE property_images SET is_cover = 1 WHERE id = ? AND property_id = ?',
      [imageId, propertyId]
    );
    return res.status(200).json({ success: true, message: 'Cover image set.', data: null });
  } catch (error) {
    console.error('[Property] setCoverImage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to set cover image.', data: null });
  }
};

module.exports = {
  createProperty,
  getProperties,
  getPropertyBySlug,
  getPropertyById,
  updateProperty,
  deleteProperty,
  deletePropertyImage,
  setCoverImage,
};
