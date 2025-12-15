/**
 * Authentication Middleware
 * Verifies JWT tokens for protected routes
 */
class AuthMiddleware {
  constructor(verifyTokenUseCase) {
    this.verifyTokenUseCase = verifyTokenUseCase;
  }

  /**
   * Verify JWT token from Authorization header
   */
  async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const token = authHeader.substring(7);
      const result = await this.verifyTokenUseCase.execute(token);

      if (!result.valid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
        });
      }

      // Attach user info to request
      req.user = result.user;
      req.tokenPayload = result.payload;

      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
      });
    }
  }
}

module.exports = AuthMiddleware;
