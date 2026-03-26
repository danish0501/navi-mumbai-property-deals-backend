'use strict';

const { pool } = require('../config/db');
const Blog = require('../models/blog.model');
const generateUniqueSlug = require('../utils/generateSlug');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middlewares/upload.middleware');

// Create
const createBlog = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { title, excerpt, content, category, tags, authorName, authorRole, readTime, status } = req.body;
    const slug = await generateUniqueSlug(title, 'blogs');

    let coverImageUrl = null, coverImagePubId = null;
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer, 'nmpd/blogs');
      coverImageUrl = uploaded.url; coverImagePubId = uploaded.public_id;
    }

    const blogId = await Blog.create(conn, {
      slug, title, excerpt, content, category, status,
      cover_image_url: coverImageUrl, cover_image_pub_id: coverImagePubId,
      author_name: authorName, author_role: authorRole, read_time: readTime
    });

    if (tags) await Blog.setTags(conn, blogId, Array.isArray(tags) ? tags : JSON.parse(tags));

    await conn.commit();
    const blog = await Blog.findOne({ id: blogId });
    const fetchedTags = await Blog.getTags(blogId);
    return res.status(201).json({ success: true, message: 'Blog created.', data: { ...blog, tags: fetchedTags } });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: 'Failed to create.' });
  } finally {
    conn.release();
  }
};

// Get All
const getBlogs = async (req, res) => {
  try {
    const { category, status = 'published', page = 1, limit = 10, search } = req.query;
    const conditions = [];
    const params = [];

    if (status) { conditions.push('b.status = ?'); params.push(status); }
    if (category) { conditions.push('b.category = ?'); params.push(category); }
    if (search) { conditions.push('(b.title LIKE ? OR b.excerpt LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const { blogs, total } = await Blog.findAll({ where, params, limit, offset });
    const blogsWithTags = await Promise.all(blogs.map(async b => ({ ...b, tags: await Blog.getTags(b.id) })));

    return res.status(200).json({ success: true, data: { blogs: blogsWithTags, pagination: { total, page: Number(page), totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

// Get One
const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) return res.status(404).json({ success: false, message: 'Not found.' });
    pool.query('UPDATE blogs SET views = views + 1 WHERE id = ?', [blog.id]);
    const tags = await Blog.getTags(blog.id);
    return res.status(200).json({ success: true, data: { ...blog, tags } });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

// Update
const updateBlog = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = req.params.id;
    const existing = await Blog.findOne({ id });
    if (!existing) return res.status(404).json({ success: false });

    const updates = { ...req.body };
    if (req.file) {
      if (existing.cover_image_pub_id) await deleteFromCloudinary(existing.cover_image_pub_id);
      const uploaded = await uploadToCloudinary(req.file.buffer, 'nmpd/blogs');
      updates.cover_image_url = uploaded.url; updates.cover_image_pub_id = uploaded.public_id;
    }

    if (req.body.title && req.body.title !== existing.title) updates.slug = await generateUniqueSlug(req.body.title, 'blogs');

    await Blog.update(conn, id, updates);
    if (req.body.tags !== undefined) await Blog.setTags(conn, id, Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags));

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
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findOne({ id: req.params.id });
    if (!blog) return res.status(404).json({ success: false });
    if (blog.cover_image_pub_id) await deleteFromCloudinary(blog.cover_image_pub_id);
    await pool.query('DELETE FROM blogs WHERE id = ?', [req.params.id]);
    return res.status(200).json({ success: true, message: 'Deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

module.exports = { createBlog, getBlogs, getBlogBySlug, updateBlog, deleteBlog };

