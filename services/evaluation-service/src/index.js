/**
 * Evaluation Service - Main Entry Point
 * Implements Hexagonal Architecture with Dependency Injection
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Domain Layer
import { Evaluation } from './domain/entities/Evaluation.js';
import { EvaluationRequest } from './domain/entities/EvaluationRequest.js';

// Application Layer - Use Cases
import { EvaluateVideoUseCase } from './application/use-cases/EvaluateVideoUseCase.js';
import { StoreEvaluationUseCase } from './application/use-cases/StoreEvaluationUseCase.js';
import { GetEvaluationHistoryUseCase } from './application/use-cases/GetEvaluationHistoryUseCase.js';

// Infrastructure Layer - Adapters
import { GeminiAIService } from './infrastructure/ai/GeminiAIService.js';
import { PostgresEvaluationRepository } from './infrastructure/database/PostgresEvaluationRepository.js';
import { JWTAuthMiddleware } from './infrastructure/auth/JWTAuthMiddleware.js';

// API Layer
import { EvaluationController } from './api/controllers/EvaluationController.js';
import { createEvaluationRoutes } from './api/routes/evaluationRoutes.js';
import { errorHandler, notFoundHandler, requestLogger } from './api/middleware/errorHandler.js';

// Load environment variables
dotenv.config();

/**
 * Evaluation Service Class
 * Encapsulates all service dependencies and configuration
 */
class EvaluationService {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3003;
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
    
    // Database configuration
    this.dbConfig = {
      host: process.env.PG_HOST,
      port: process.env.PG_PORT || 5432,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      ssl: process.env.PG_SSL || 'false'
    };

    this.initializeInfrastructure();
    this.initializeUseCases();
    this.initializeAPI();
  }

  /**
   * Initialize infrastructure layer (adapters)
   */
  initializeInfrastructure() {
    console.log('🔧 Initializing infrastructure layer...');

    // AI Service Adapter
    this.aiService = new GeminiAIService();
    console.log('✅ Gemini AI Service initialized');

    // Database Repository Adapter
    this.evaluationRepository = new PostgresEvaluationRepository(this.dbConfig);
    console.log('✅ PostgreSQL Evaluation Repository initialized');

    // JWT Authentication Middleware
    this.jwtMiddleware = new JWTAuthMiddleware(this.jwtSecret);
    console.log('✅ JWT Authentication Middleware initialized');
  }

  /**
   * Initialize application layer (use cases)
   */
  initializeUseCases() {
    console.log('🔧 Initializing application layer...');

    // Dependency Injection: Inject repositories into use cases
    this.evaluateVideoUseCase = new EvaluateVideoUseCase(
      this.aiService,
      this.evaluationRepository
    );

    this.storeEvaluationUseCase = new StoreEvaluationUseCase(
      this.evaluationRepository
    );

    this.getEvaluationHistoryUseCase = new GetEvaluationHistoryUseCase(
      this.evaluationRepository
    );

    console.log('✅ Use cases initialized');
  }

  /**
   * Initialize API layer (controllers and routes)
   */
  initializeAPI() {
    console.log('🔧 Initializing API layer...');

    // Express middleware
    this.app.use(cors());
    this.app.use(express.json({ limit: '5mb' }));
    this.app.use(requestLogger);

    // Controller
    this.controller = new EvaluationController(
      this.evaluateVideoUseCase,
      this.storeEvaluationUseCase,
      this.getEvaluationHistoryUseCase
    );

    // Routes
    const routes = createEvaluationRoutes(this.controller, this.jwtMiddleware);
    this.app.use('/api', routes);

    // Legacy routes for backward compatibility (without /api prefix)
    this.app.use('/', routes);

    // Error handlers
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);

    console.log('✅ API layer initialized');
  }

  /**
   * Start the service
   */
  async start() {
    try {
      console.log('\n🚀 Starting Evaluation Service...\n');

      // Display configuration (masked)
      console.log('📋 Configuration:');
      console.log(`   Port: ${this.port}`);
      console.log(`   Database Host: ${this.dbConfig.host || 'Not configured'}`);
      console.log(`   JWT Secret: ${this.jwtSecret ? '***' + this.jwtSecret.slice(-4) : 'Not configured'}`);
      console.log('');

      // Start Express server
      this.server = this.app.listen(this.port, () => {
        console.log('\n✅ Evaluation Service is running!\n');
        console.log(`   🌐 Server: http://localhost:${this.port}`);
        console.log(`   🏥 Health: http://localhost:${this.port}/api/health`);
        console.log('\n📚 Available endpoints:');
        console.log('   POST   /api/evaluate');
        console.log('   POST   /api/store-evaluation');
        console.log('   GET    /api/concept-history?email=<email>');
        console.log('   GET    /api/project-history?email=<email>');
        console.log('   GET    /api/health');
        console.log('\n🔐 Authentication:');
        console.log('   JWT tokens: Optional (Bearer <token> in Authorization header)');
        console.log('   API keys: Required in request body for evaluation');
        console.log('\n');
      });

      // Handle graceful shutdown
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));

    } catch (error) {
      console.error('❌ Failed to start Evaluation Service:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(signal) {
    console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);

    // Close HTTP server
    if (this.server) {
      this.server.close(() => {
        console.log('✅ HTTP server closed');
      });
    }

    // Close database connection
    if (this.evaluationRepository && this.evaluationRepository.close) {
      await this.evaluationRepository.close();
      console.log('✅ Database connection closed');
    }

    console.log('👋 Evaluation Service stopped\n');
    process.exit(0);
  }
}

// Create and start the service
const service = new EvaluationService();
service.start();

export default EvaluationService;
