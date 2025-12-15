/**
 * VerifyToken Use Case
 * Verifies JWT token and retrieves user information
 */
class VerifyToken {
  constructor({ tokenService, userRepository }) {
    this.tokenService = tokenService;
    this.userRepository = userRepository;
  }

  /**
   * Execute token verification
   * @param {string} token - JWT token
   * @returns {Promise<Object>} { valid, user, payload }
   */
  async execute(token) {
    if (!token) {
      throw new Error('Token is required');
    }

    try {
      // Verify and decode token
      const payload = await this.tokenService.verifyToken(token);

      // Retrieve user from database
      const user = await this.userRepository.findById(payload.userId);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        valid: true,
        user: user.toPublicJSON(),
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }
}

module.exports = VerifyToken;
