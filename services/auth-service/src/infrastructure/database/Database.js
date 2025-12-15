const { Pool } = require('pg');

/**
 * Database Configuration and Connection Pool
 */
class Database {
  constructor() {
    this.pool = null;
  }

  /**
   * Initialize database connection pool
   */
  async connect() {
    if (this.pool) {
      return this.pool;
    }

    this.pool = new Pool({
      host: process.env.PG_HOST,
      port: process.env.PG_PORT || 5432,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connected successfully');
      client.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }

    return this.pool;
  }

  /**
   * Get connection pool
   */
  getPool() {
    if (!this.pool) {
      throw new Error('Database not initialized. Call connect() first.');
    }
    return this.pool;
  }

  /**
   * Close all connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Database connections closed');
    }
  }
}

module.exports = new Database();
