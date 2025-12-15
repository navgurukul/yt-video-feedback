/**
 * Authentication Controller
 * Handles HTTP requests for authentication operations
 */
class AuthController {
  constructor({ 
    authenticateUser, 
    validateApiKey, 
    verifyToken, 
    getUserApiKey 
  }) {
    this.authenticateUser = authenticateUser;
    this.validateApiKey = validateApiKey;
    this.verifyToken = verifyToken;
    this.getUserApiKey = getUserApiKey;
  }

  /**
   * POST /auth/login
   * Authenticate user after Supabase login
   */
  async login(req, res) {
    try {
      const { email, name, supabaseId } = req.body;

      if (!email || !name) {
        return res.status(400).json({
          success: false,
          error: 'Email and name are required',
        });
      }

      const result = await this.authenticateUser.execute({
        email,
        name,
        supabaseId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /auth/api-key
   * Validate and store user's Gemini API key
   */
  async setApiKey(req, res) {
    try {
      const { email, apiKey } = req.body;

      if (!email || !apiKey) {
        return res.status(400).json({
          success: false,
          error: 'Email and API key are required',
        });
      }

      const result = await this.validateApiKey.execute({
        email,
        apiKey,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('API key validation error:', error);
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /auth/verify-token
   * Verify JWT token
   */
  async verifyTokenEndpoint(req, res) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'No token provided',
        });
      }

      const token = authHeader.substring(7);
      const result = await this.verifyToken.execute(token);

      if (!result.valid) {
        return res.status(401).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /auth/api-key/:email
   * Get decrypted API key for user (internal use)
   */
  async getApiKey(req, res) {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
        });
      }

      const result = await this.getUserApiKey.execute(email);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get API key error:', error);
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /auth/health
   * Health check endpoint
   */
  async healthCheck(req, res) {
    return res.status(200).json({
      success: true,
      service: 'auth-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = AuthController;
