const jwt = require('jsonwebtoken');
const ITokenService = require('../../domain/services/ITokenService');

/**
 * JWT Token Service Implementation
 * Handles JWT generation and verification
 */
class JWTTokenService extends ITokenService {
  constructor(jwtSecret, options = {}) {
    super();
    this.jwtSecret = jwtSecret;
    this.expiresIn = options.expiresIn || '7d'; // Default 7 days
    this.issuer = options.issuer || 'yt-feedback-auth-service';
  }

  /**
   * Generate a JWT token
   */
  async generateToken(payload) {
    try {
      const token = jwt.sign(
        {
          ...payload,
          iss: this.issuer,
          iat: Math.floor(Date.now() / 1000),
        },
        this.jwtSecret,
        {
          expiresIn: this.expiresIn,
        }
      );

      return token;
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
      });

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }
}

module.exports = JWTTokenService;
