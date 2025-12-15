/**
 * User Entity - Core business object
 * Represents a user in the system with authentication capabilities
 */
class User {
  constructor({ id, email, name, apiKey, createdAt, updatedAt }) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.apiKey = apiKey; // Encrypted Gemini API key
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Validate user email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate Gemini API key format
   */
  static isValidApiKey(apiKey) {
    return apiKey && apiKey.startsWith('AIza') && apiKey.length > 20;
  }

  /**
   * Check if user has a valid API key
   */
  hasValidApiKey() {
    return this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Create a safe representation without sensitive data
   */
  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      hasApiKey: this.hasValidApiKey(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = User;
