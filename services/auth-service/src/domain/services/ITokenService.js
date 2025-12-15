/**
 * ITokenService - Port for JWT token operations
 */
class ITokenService {
  /**
   * Generate a JWT token for a user
   * @param {Object} payload - Token payload (userId, email)
   * @returns {Promise<string>} JWT token
   */
  async generateToken(payload) {
    throw new Error('Method not implemented');
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token
   * @returns {Promise<Object>} Decoded payload
   */
  async verifyToken(token) {
    throw new Error('Method not implemented');
  }
}

module.exports = ITokenService;
