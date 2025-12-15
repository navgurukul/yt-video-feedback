/**
 * GetUserApiKey Use Case
 * Retrieves and decrypts user's Gemini API key
 */
class GetUserApiKey {
  constructor({ userRepository, encryptionService }) {
    this.userRepository = userRepository;
    this.encryptionService = encryptionService;
  }

  /**
   * Execute API key retrieval
   * @param {string} email - User email
   * @returns {Promise<Object>} { apiKey }
   */
  async execute(email) {
    // Find user
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.hasValidApiKey()) {
      throw new Error('User has no API key configured');
    }

    // Decrypt API key
    const decryptedApiKey = await this.encryptionService.decrypt(user.apiKey);

    return {
      apiKey: decryptedApiKey,
    };
  }
}

module.exports = GetUserApiKey;
