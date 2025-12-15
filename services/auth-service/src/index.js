require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Infrastructure
const Database = require('./infrastructure/database/Database');
const PostgresUserRepository = require('./infrastructure/repositories/PostgresUserRepository');
const AESEncryptionService = require('./infrastructure/services/AESEncryptionService');
const JWTTokenService = require('./infrastructure/services/JWTTokenService');

// Application Use Cases
const AuthenticateUser = require('./application/use-cases/AuthenticateUser');
const ValidateApiKey = require('./application/use-cases/ValidateApiKey');
const VerifyToken = require('./application/use-cases/VerifyToken');
const GetUserApiKey = require('./application/use-cases/GetUserApiKey');

// Presentation
const AuthController = require('./presentation/controllers/AuthController');
const createAuthRoutes = require('./presentation/routes/authRoutes');

/**
 * Authentication Service Entry Point
 * Implements Hexagonal Architecture with Dependency Injection
 */
class AuthService {
  constructor() {
    this.app = express();
    this.port = process.env.AUTH_SERVICE_PORT || 3001;
  }

  /**
   * Initialize dependencies (Dependency Injection Container)
   */
  async initializeDependencies() {
    // Connect to database
    await Database.connect();
    const dbPool = Database.getPool();

    // Infrastructure layer (Adapters)
    const userRepository = new PostgresUserRepository(dbPool);
    const encryptionService = new AESEncryptionService(
      process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production'
    );
    const tokenService = new JWTTokenService(
      process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        issuer: 'yt-feedback-auth-service',
      }
    );

    // Application layer (Use Cases)
    const authenticateUser = new AuthenticateUser({
      userRepository,
      tokenService,
      encryptionService,
    });

    const validateApiKey = new ValidateApiKey({
      userRepository,
      encryptionService,
    });

    const verifyToken = new VerifyToken({
      tokenService,
      userRepository,
    });

    const getUserApiKey = new GetUserApiKey({
      userRepository,
      encryptionService,
    });

    // Presentation layer (Controllers)
    const authController = new AuthController({
      authenticateUser,
      validateApiKey,
      verifyToken,
      getUserApiKey,
    });

    return { authController };
  }

  /**
   * Configure Express middleware
   */
  configureMiddleware() {
    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    }));

    // Body parsers
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Configure routes
   */
  configureRoutes(authController) {
    // Mount auth routes at /auth
    const authRoutes = createAuthRoutes(authController);
    this.app.use('/auth', authRoutes);

    // Root health check
    this.app.get('/', (req, res) => {
      res.json({
        service: 'auth-service',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    });
  }

  /**
   * Start the service
   */
  async start() {
    try {
      // Initialize dependencies
      console.log('🔧 Initializing dependencies...');
      const { authController } = await this.initializeDependencies();

      // Configure middleware
      console.log('⚙️  Configuring middleware...');
      this.configureMiddleware();

      // Configure routes
      console.log('🛣️  Configuring routes...');
      this.configureRoutes(authController);

      // Start server
      this.app.listen(this.port, () => {
        console.log('');
        console.log('🚀 ======================================');
        console.log(`   Authentication Service Started`);
        console.log(`   Port: ${this.port}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('   ======================================');
        console.log('');
      });
    } catch (error) {
      console.error('❌ Failed to start service:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down gracefully...');
    await Database.close();
    process.exit(0);
  }
}

// Create and start service
const service = new AuthService();
service.start();

// Handle shutdown signals
process.on('SIGINT', () => service.shutdown());
process.on('SIGTERM', () => service.shutdown());

module.exports = AuthService;
