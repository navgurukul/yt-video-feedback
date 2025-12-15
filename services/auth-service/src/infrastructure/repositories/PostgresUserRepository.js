const { Pool } = require('pg');
const User = require('../../domain/entities/User');
const IUserRepository = require('../../domain/repositories/IUserRepository');

/**
 * PostgreSQL User Repository Implementation
 * Adapter that implements the IUserRepository port
 */
class PostgresUserRepository extends IUserRepository {
  constructor(dbPool) {
    super();
    this.pool = dbPool;
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.pool.query(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return this._mapRowToUser(result.rows[0]);
  }

  /**
   * Find user by ID
   */
  async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this._mapRowToUser(result.rows[0]);
  }

  /**
   * Create a new user
   */
  async create(userData) {
    const query = `
      INSERT INTO users (email, name, supabase_id, api_key)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      userData.email,
      userData.name,
      userData.supabaseId || null,
      userData.apiKey || null,
    ];

    const result = await this.pool.query(query, values);
    return this._mapRowToUser(result.rows[0]);
  }

  /**
   * Update user's API key
   */
  async updateApiKey(email, encryptedApiKey) {
    const query = `
      UPDATE users 
      SET api_key = $1, updated_at = NOW()
      WHERE email = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [encryptedApiKey, email]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this._mapRowToUser(result.rows[0]);
  }

  /**
   * Update user data
   */
  async update(id, updates) {
    const allowedFields = ['name', 'api_key'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [id, ...fields.map(field => updates[field])];
    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this._mapRowToUser(result.rows[0]);
  }

  /**
   * Delete user by ID
   */
  async delete(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0;
  }

  /**
   * Map database row to User entity
   */
  _mapRowToUser(row) {
    return new User({
      id: row.id,
      email: row.email,
      name: row.name,
      apiKey: row.api_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

module.exports = PostgresUserRepository;
