/**
 * @fileoverview PostgreSQL database configuration and connection pool management
 * @module server/config/database
 */

import pkg from 'pg';
const { Pool } = pkg;

/**
 * PostgreSQL connection configuration object
 * @typedef {Object} PostgresConfig
 * @property {string} host - Database host address
 * @property {number} port - Database port (default: 5432)
 * @property {string} user - Database username
 * @property {string} password - Database password
 * @property {string} database - Database name
 * @property {Object|boolean} ssl - SSL configuration
 * @property {number} connectionTimeoutMillis - Connection timeout in milliseconds
 * @property {number} idleTimeoutMillis - Idle connection timeout in milliseconds
 * @property {number} max - Maximum number of clients in the pool
 */
const pgConfig = {
  host: process.env.PG_HOST,
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
};

/**
 * PostgreSQL connection pool instance
 * Manages database connections efficiently with automatic pooling
 * @type {Pool}
 */
const pgPool = new Pool(pgConfig);

/**
 * Test database connection on startup
 * Logs connection status and exits on critical errors
 */
pgPool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('PostgreSQL connection error:', err);
  } else {
    console.log('✓ Connected to PostgreSQL database');
  }
});

/**
 * Handle unexpected errors on idle database clients
 * Prevents the application from crashing due to disconnected clients
 */
pgPool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

export { pgPool, pgConfig };
