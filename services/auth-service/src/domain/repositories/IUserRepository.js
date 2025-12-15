/**
 * IUserRepository - Port (Interface) for User data access
 * This is the contract that infrastructure adapters must implement
 */
class IUserRepository {
  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    throw new Error('Method not implemented');
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new user
   * @param {Object} userData - User data (email, name, apiKey)
   * @returns {Promise<User>}
   */
  async create(userData) {
    throw new Error('Method not implemented');
  }

  /**
   * Update user's API key
   * @param {string} email - User email
   * @param {string} encryptedApiKey - Encrypted API key
   * @returns {Promise<User>}
   */
  async updateApiKey(email, encryptedApiKey) {
    throw new Error('Method not implemented');
  }

  /**
   * Update user data
   * @param {string} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<User>}
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete user by ID
   * @param {string} id - User ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }
}

module.exports = IUserRepository;
