'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'navi_mumbai_property_deals',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
});

/** Test the database connection on startup **/
const testConnection = async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('✅  MySQL connected — database:', process.env.DB_NAME);
    conn.release();
  } catch (error) {
    console.error('❌  MySQL connection failed:', error.message);
    throw error;
  }
};

module.exports = { pool, testConnection };
