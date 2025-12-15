const User = require('../../domain/entities/User');

/**
 * ValidateApiKey Use Case
 * Validates and stores user's Gemini API key
 */
class ValidateApiKey {
  constructor({ userRepository, encryptionService }) {
    this.userRepository = userRepository;
    this.encryptionService = encryptionService;
  }

  /**
   * Execute API key validation and storage
   * @param {Object} params - { email, apiKey }
   * @returns {Promise<Object>} { success, user }
   */
  async execute({ email, apiKey }) {
    // Validate email
    if (!User.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Validate API key format
    if (!User.isValidApiKey(apiKey)) {
      throw new Error('Invalid API key format. Must start with "AIza"');
    }

    // Find user
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Encrypt API key
    const encryptedApiKey = await this.encryptionService.encrypt(apiKey);

    // Update user with encrypted API key
    const updatedUser = await this.userRepository.updateApiKey(email, encryptedApiKey);

    return {
      success: true,
      user: updatedUser.toPublicJSON(),
    };
  }
}

module.exports = ValidateApiKey;
