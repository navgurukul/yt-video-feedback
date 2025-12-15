const crypto = require('crypto');
const IEncryptionService = require('../../domain/services/IEncryptionService');

/**
 * AES Encryption Service Implementation
 * Uses AES-256-GCM for encrypting sensitive data like API keys
 */
class AESEncryptionService extends IEncryptionService {
  constructor(encryptionKey) {
    super();
    
    // Ensure key is 32 bytes for AES-256
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(encryptionKey)
      .digest();
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   */
  async encrypt(plaintext) {
    try {
      // Generate random IV (Initialization Vector)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV, auth tag, and encrypted data
      // Format: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt encrypted text using AES-256-GCM
   */
  async decrypt(encrypted) {
    try {
      // Split the encrypted string
      const parts = encrypted.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encryptedData] = parts;

      // Convert hex strings back to buffers
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}

module.exports = AESEncryptionService;
