'use strict';

const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await testConnection();

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║       Navi Mumbai Property Deals - API Server        ║
╠══════════════════════════════════════════════════════╣
║  Status   : Running                                  ║
║  Port     : ${PORT}                                  ║
║  Env      : ${process.env.NODE_ENV || 'development'} ║
║  Time     : ${new Date().toISOString()}              ║
╚══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
