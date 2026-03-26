'use strict';

const { pool } = require('../config/db');

const Blog = {
  /**
   * Create a blog post.
   */
  async create(conn, blogData) {
    const {
      slug, title, excerpt, content, category, cover_image_url, cover_image_pub_id,
      author_name, author_role, read_time, status
    } = blogData;

    const [result] = await conn.query(
      `INSERT INTO blogs 
        (slug, title, excerpt, content, category, cover_image_url, cover_image_pub_id,
         author_name, author_role, read_time, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [slug, title, excerpt, content, category, cover_image_url, cover_image_pub_id, author_name, author_role, read_time, status]
    );
    return result.insertId;
  },

  /**
   * Find a blog by slug or ID.
   */
  async findOne(filter) {
    const key = filter.slug ? 'slug' : 'id';
    const val = filter.slug || filter.id;
    const [rows] = await pool.query(`SELECT * FROM blogs WHERE ${key} = ? LIMIT 1`, [val]);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Search and List blogs.
   */
  async findAll({ where, params, limit, offset }) {
    const [blogs] = await pool.query(
      `SELECT * FROM blogs b ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM blogs b ${where}`, params);
    return { blogs, total };
  },

  /**
   * Update blog post.
   */
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
    await conn.query(`UPDATE blogs SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  /**
   * Tags
   */
  async getTags(blogId) {
    const [rows] = await pool.query('SELECT tag FROM blog_tags WHERE blog_id = ?', [blogId]);
    return rows.map(r => r.tag);
  },

  async setTags(conn, blogId, tags) {
    await conn.query('DELETE FROM blog_tags WHERE blog_id = ?', [blogId]);
    if (tags?.length) {
      const rows = tags.map(t => [blogId, t.trim()]);
      await conn.query('INSERT INTO blog_tags (blog_id, tag) VALUES ?', [rows]);
    }
  }
};

module.exports = Blog;
