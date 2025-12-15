const User = require('../../domain/entities/User');

/**
 * AuthenticateUser Use Case
 * Handles user authentication via Supabase and JWT token generation
 */
class AuthenticateUser {
  constructor({ userRepository, tokenService, encryptionService }) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.encryptionService = encryptionService;
  }

  /**
   * Execute authentication
   * @param {Object} params - { email, name, supabaseId }
   * @returns {Promise<Object>} { user, token }
   */
  async execute({ email, name, supabaseId }) {
    // Validate input
    if (!User.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Name is required');
    }

    // Find or create user
    let user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Create new user
      user = await this.userRepository.create({
        email,
        name,
        supabaseId,
        apiKey: null, // Will be set separately
      });
    }

    // Generate JWT token
    const token = await this.tokenService.generateToken({
      userId: user.id,
      email: user.email,
      supabaseId: supabaseId,
    });

    return {
      user: user.toPublicJSON(),
      token,
    };
  }
}

module.exports = AuthenticateUser;
