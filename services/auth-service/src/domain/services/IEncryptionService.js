/**
 * IEncryptionService - Port for encryption operations
 * Used for securely storing API keys
 */
class IEncryptionService {
  /**
   * Encrypt a plaintext string
   * @param {string} plaintext - Text to encrypt
   * @returns {Promise<string>} Encrypted text
   */
  async encrypt(plaintext) {
    throw new Error('Method not implemented');
  }

  /**
   * Decrypt an encrypted string
   * @param {string} encrypted - Encrypted text
   * @returns {Promise<string>} Decrypted plaintext
   */
  async decrypt(encrypted) {
    throw new Error('Method not implemented');
  }
}

module.exports = IEncryptionService;
