/**
 * Infrastructure: JWT Authentication Middleware
 * Verifies JWT tokens from the auth service
 */

import jwt from 'jsonwebtoken';

export class JWTAuthMiddleware {
  constructor(jwtSecret) {
    this.jwtSecret = jwtSecret;
  }

  /**
   * Creates Express middleware function for JWT verification
   * @param {boolean} optional - If true, continues even if no token provided
   * @returns {Function} Express middleware
   */
  verify(optional = false) {
    return (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;

        // If no auth header and optional, continue without auth
        if (!authHeader) {
          if (optional) {
            console.log('ℹ️ No authorization header, continuing without auth');
            req.user = null;
            return next();
          }
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'No authorization header provided'
          });
        }

        // Extract token from "Bearer <token>"
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          if (optional) {
            console.log('ℹ️ Invalid authorization format, continuing without auth');
            req.user = null;
            return next();
          }
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid authorization header format. Expected: Bearer <token>'
          });
        }

        const token = parts[1];

        // Verify token
        const decoded = jwt.verify(token, this.jwtSecret);

        // Attach user info to request
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          name: decoded.name,
          supabaseId: decoded.supabaseId
        };

        console.log('✅ JWT verified for user:', req.user.email);
        next();
      } catch (error) {
        console.error('❌ JWT verification error:', error.message);

        if (optional) {
          console.log('ℹ️ JWT verification failed but continuing without auth');
          req.user = null;
          return next();
        }

        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token has expired'
          });
        }

        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token'
          });
        }

        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication failed'
        });
      }
    };
  }

  /**
   * Extract user email from request (supports both JWT and body)
   * @param {Object} req - Express request object
   * @returns {string|null} - User email or null
   */
  static getUserEmail(req) {
    // Try JWT first
    if (req.user && req.user.email) {
      return req.user.email;
    }

    // Fallback to request body
    if (req.body && req.body.userEmail) {
      return req.body.userEmail;
    }

    return null;
  }

  /**
   * Extract user ID from request (supports both JWT and body)
   * @param {Object} req - Express request object
   * @returns {number|null} - User ID or null
   */
  static getUserId(req) {
    // Try JWT first
    if (req.user && req.user.id) {
      return req.user.id;
    }

    // Fallback to request body
    if (req.body && req.body.userId) {
      return req.body.userId;
    }

    return null;
  }
}
