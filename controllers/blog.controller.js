'use strict';
const { pool } = require('../config/db');
const generateUniqueSlug = require('../utils/generateSlug');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middlewares/upload.middleware');

// Helper — fetch tags for a blog 
const fetchTags = async (blogId) => {
  const [rows] = await pool.query('SELECT tag FROM blog_tags WHERE blog_id = ?', [blogId]);
  return rows.map((r) => r.tag);
};

// Create Blog 
const createBlog = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { title, excerpt, content, category, tags, authorName, authorRole, readTime, status } = req.body;

    const slug = await generateUniqueSlug(title, 'blogs');

    let coverImageUrl = null;
    let coverImagePubId = null;
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer, 'nmpd/blogs');
      coverImageUrl = uploaded.url;
      coverImagePubId = uploaded.public_id;
    }

    const [result] = await conn.query(
      `INSERT INTO blogs
        (slug, title, excerpt, content, category, cover_image_url, cover_image_pub_id,
         author_name, author_role, read_time, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        slug, title, excerpt || null, content, category,
        coverImageUrl, coverImagePubId,
        authorName, authorRole || null, readTime || null,
        status || 'draft',
      ]
    );

    const blogId = result.insertId;

    const tagsArr = Array.isArray(tags) ? tags : JSON.parse(tags || '[]');
    if (tagsArr.length) {
      const tagRows = tagsArr.map((t) => [blogId, t.trim()]);
      await conn.query('INSERT INTO blog_tags (blog_id, tag) VALUES ?', [tagRows]);
    }

    await conn.commit();

    const [rows] = await pool.query('SELECT * FROM blogs WHERE id = ? LIMIT 1', [blogId]);
    const fetchedTags = await fetchTags(blogId);

    return res.status(201).json({
      success: true,
      message: 'Blog post created.',
      data: { ...rows[0], tags: fetchedTags },
    });
  } catch (error) {
    await conn.rollback();
    console.error('[Blog] createBlog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create blog.', data: null });
  } finally {
    conn.release();
  }
};

// Get All Blogs
const getBlogs = async (req, res) => {
  try {
    const { category, status = 'published', page = 1, limit = 10, search } = req.query;

    const conditions = [];
    const params = [];

    if (status) { conditions.push('b.status = ?'); params.push(status); }
    if (category) { conditions.push('b.category = ?'); params.push(category); }
    if (search) {
      conditions.push('(b.title LIKE ? OR b.excerpt LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM blogs b ${where}`,
      params
    );

    const [blogs] = await pool.query(
      `SELECT b.id, b.slug, b.title, b.excerpt, b.category, b.cover_image_url,
              b.author_name, b.author_role, b.read_time, b.status, b.views,
              b.created_at, b.updated_at
       FROM blogs b ${where}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    // Attach tags for each blog
    const blogsWithTags = await Promise.all(
      blogs.map(async (blog) => ({ ...blog, tags: await fetchTags(blog.id) }))
    );

    return res.status(200).json({
      success: true,
      message: 'Blogs fetched.',
      data: {
        blogs: blogsWithTags,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('[Blog] getBlogs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch blogs.', data: null });
  }
};

// Get Blog By Slug
const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await pool.query('SELECT * FROM blogs WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Blog not found.', data: null });
    }
    const blog = rows[0];
    pool.query('UPDATE blogs SET views = views + 1 WHERE id = ?', [blog.id]);
    const tags = await fetchTags(blog.id);
    return res.status(200).json({ success: true, message: 'Blog fetched.', data: { ...blog, tags } });
  } catch (error) {
    console.error('[Blog] getBlogBySlug error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch blog.', data: null });
  }
};

// Update Blog
const updateBlog = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const [existing] = await conn.query('SELECT * FROM blogs WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Blog not found.', data: null });
    }

    const { title, excerpt, content, category, tags, authorName, authorRole, readTime, status } = req.body;

    let coverImageUrl = existing[0].cover_image_url;
    let coverImagePubId = existing[0].cover_image_pub_id;

    if (req.file) {
      if (existing[0].cover_image_pub_id) {
        await deleteFromCloudinary(existing[0].cover_image_pub_id);
      }
      const uploaded = await uploadToCloudinary(req.file.buffer, 'nmpd/blogs');
      coverImageUrl = uploaded.url;
      coverImagePubId = uploaded.public_id;
    }

    // Regenerate slug if title changed
    let slug = existing[0].slug;
    if (title && title !== existing[0].title) {
      slug = await generateUniqueSlug(title, 'blogs');
    }

    await conn.query(
      `UPDATE blogs SET
        slug=?, title=?, excerpt=?, content=?, category=?, cover_image_url=?,
        cover_image_pub_id=?, author_name=?, author_role=?, read_time=?, status=?
       WHERE id=?`,
      [
        slug,
        title ?? existing[0].title,
        excerpt ?? existing[0].excerpt,
        content ?? existing[0].content,
        category ?? existing[0].category,
        coverImageUrl, coverImagePubId,
        authorName ?? existing[0].author_name,
        authorRole ?? existing[0].author_role,
        readTime ?? existing[0].read_time,
        status ?? existing[0].status,
        id,
      ]
    );

    if (tags !== undefined) {
      await conn.query('DELETE FROM blog_tags WHERE blog_id = ?', [id]);
      const tagsArr = Array.isArray(tags) ? tags : JSON.parse(tags || '[]');
      if (tagsArr.length) {
        const tagRows = tagsArr.map((t) => [id, t.trim()]);
        await conn.query('INSERT INTO blog_tags (blog_id, tag) VALUES ?', [tagRows]);
      }
    }

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM blogs WHERE id = ? LIMIT 1', [id]);
    const updatedTags = await fetchTags(id);

    return res.status(200).json({
      success: true,
      message: 'Blog updated.',
      data: { ...updated[0], tags: updatedTags },
    });
  } catch (error) {
    await conn.rollback();
    console.error('[Blog] updateBlog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update blog.', data: null });
  } finally {
    conn.release();
  }
};

// Delete Blog
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM blogs WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Blog not found.', data: null });
    }
    if (rows[0].cover_image_pub_id) {
      await deleteFromCloudinary(rows[0].cover_image_pub_id);
    }
    await pool.query('DELETE FROM blogs WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Blog deleted.', data: null });
  } catch (error) {
    console.error('[Blog] deleteBlog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete blog.', data: null });
  }
};

module.exports = { createBlog, getBlogs, getBlogBySlug, updateBlog, deleteBlog };
