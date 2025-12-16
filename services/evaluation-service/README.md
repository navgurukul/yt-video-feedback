# Evaluation Service

Microservice for video evaluation using Google Gemini AI, built with **Hexagonal Architecture** (Ports and Adapters pattern).

## 🏗️ Architecture Overview

This service follows **Hexagonal Architecture** principles to ensure:
- **Clean separation of concerns**
- **Testability** - Easy to mock dependencies
- **Flexibility** - Easy to swap implementations
- **Maintainability** - Clear dependencies flow

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                     API Layer                           │
│  (Controllers, Routes, Middleware - HTTP Interface)     │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                Application Layer                        │
│         (Use Cases - Business Logic)                    │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                  Domain Layer                           │
│     (Entities, Repository Interfaces - Core Domain)     │
└─────────────────────────────────────────────────────────┘
                   ▲
┌──────────────────┴──────────────────────────────────────┐
│            Infrastructure Layer                         │
│  (Adapters: Gemini AI, PostgreSQL, JWT - External)     │
└─────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
services/evaluation-service/
├── src/
│   ├── domain/                    # Core domain logic
│   │   ├── entities/              # Business entities
│   │   │   ├── Evaluation.js      # Evaluation entity with business rules
│   │   │   └── EvaluationRequest.js  # Request entity with validation
│   │   └── repositories/          # Repository interfaces (ports)
│   │       ├── IEvaluationRepository.js  # Data persistence interface
│   │       └── IAIService.js      # AI service interface
│   │
│   ├── application/               # Application business rules
│   │   └── use-cases/             # Use cases (application services)
│   │       ├── EvaluateVideoUseCase.js      # Video evaluation workflow
│   │       ├── StoreEvaluationUseCase.js    # Store evaluation workflow
│   │       └── GetEvaluationHistoryUseCase.js  # Fetch history workflow
│   │
│   ├── infrastructure/            # External adapters
│   │   ├── ai/
│   │   │   └── GeminiAIService.js           # Gemini AI adapter
│   │   ├── database/
│   │   │   └── PostgresEvaluationRepository.js  # PostgreSQL adapter
│   │   └── auth/
│   │       └── JWTAuthMiddleware.js         # JWT authentication
│   │
│   ├── api/                       # HTTP interface
│   │   ├── controllers/
│   │   │   └── EvaluationController.js  # HTTP request handlers
│   │   ├── routes/
│   │   │   └── evaluationRoutes.js      # Route definitions
│   │   └── middleware/
│   │       └── errorHandler.js          # Error handling middleware
│   │
│   └── index.js                   # Service entry point with DI
│
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database
- Gemini API key (optional, users can provide their own)
- JWT secret (should match auth service)

### Installation

```bash
cd services/evaluation-service
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Configure environment variables in `.env`:
```env
# Service
PORT=3003
NODE_ENV=development

# Database
PG_HOST=your_database_host
PG_PORT=5432
PG_USER=your_database_user
PG_PASSWORD=your_database_password
PG_DATABASE=your_database_name
PG_SSL=true

# JWT (must match auth service)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRY=24h

# Optional: Fallback Gemini API key
GEMINI_API_KEY=
```

### Running the Service

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

The service will start on `http://localhost:3003`.

## 📚 API Endpoints

### Health Check
```
GET /api/health
```
Returns service health status.

**Response:**
```json
{
  "status": "healthy",
  "service": "evaluation-service",
  "timestamp": "2025-12-15T10:30:00.000Z"
}
```

### Evaluate Video
```
POST /api/evaluate
```
Evaluates a video using Gemini AI.

**Headers:**
- `Authorization: Bearer <jwt-token>` (optional)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "videoUrl": "https://youtube.com/watch?v=...",
  "videoDetails": "Description of the video",
  "promptbegining": "Evaluate this video for...",
  "rubric": { /* rubric object */ },
  "evaluationType": "concept",  // or "project"
  "structuredreturnedconfig": { /* Gemini config */ },
  "apiKey": "AIza...",  // User's Gemini API key (required)
  "userEmail": "user@example.com",
  "selectedPhase": "Phase1",
  "selectedVideoTitle": "Home Page"
}
```

**Response:**
```json
{
  "raw": "Full text response",
  "text": "Processed text",
  "parsed": { /* Parsed JSON evaluation */ }
}
```

### Store Evaluation
```
POST /api/store-evaluation
```
Stores evaluation results in the database.

**Headers:**
- `Authorization: Bearer <jwt-token>` (optional)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "userId": 123,
  "userEmail": "user@example.com",
  "videoUrl": "https://youtube.com/watch?v=...",
  "videoType": "concept",  // or "project"
  "evaluationData": {
    "evaluation_result": { /* Evaluation data */ }
  },
  "videoDetails": "Video description",
  "selectedPhase": "Phase1",
  "selectedVideoTitle": "Home Page"
}
```

**Response:**
```json
{
  "success": true,
  "id": 456,
  "message": "concept evaluation stored successfully"
}
```

### Get Concept History
```
GET /api/concept-history?email=user@example.com
```
Retrieves concept evaluation history for a user.

**Query Parameters:**
- `email` (required): User's email address
- `limit` (optional): Maximum results (default: 50)
- `offset` (optional): Results to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userEmail": "user@example.com",
      "videoUrl": "https://...",
      "evaluationResult": { /* Evaluation data */ },
      "createdAt": "2025-12-15T10:00:00.000Z"
    }
  ]
}
```

### Get Project History
```
GET /api/project-history?email=user@example.com
```
Retrieves project evaluation history for a user.

**Query Parameters:**
- `email` (required): User's email address
- `limit` (optional): Maximum results (default: 50)
- `offset` (optional): Results to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "userEmail": "user@example.com",
      "videoUrl": "https://...",
      "evaluationResult": { /* Evaluation data */ },
      "createdAt": "2025-12-15T11:00:00.000Z"
    }
  ]
}
```

## 🔐 Authentication

The service supports **optional JWT authentication**:

1. **With JWT Token** (recommended for production):
   - Include `Authorization: Bearer <token>` header
   - User info extracted from JWT
   - More secure, no need to pass email in request

2. **Without JWT Token** (backward compatible):
   - Pass `userEmail` in request body or query params
   - API key required for evaluation endpoints
   - Useful during migration phase

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3003/api/health
```

### Evaluate Video (with API key)
```bash
curl -X POST http://localhost:3003/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://youtube.com/...",
    "videoDetails": "Test video",
    "promptbegining": "Evaluate...",
    "evaluationType": "concept",
    "apiKey": "AIza..."
  }'
```

### With JWT Authentication
```bash
curl -X POST http://localhost:3003/api/evaluate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{
    "videoUrl": "https://youtube.com/...",
    "apiKey": "AIza..."
  }'
```

## 🏗️ Hexagonal Architecture Explained

### Why Hexagonal Architecture?

1. **Independence from Frameworks**: Core domain logic doesn't depend on Express, Gemini SDK, or PostgreSQL
2. **Testability**: Easy to mock AI service or database for unit tests
3. **Flexibility**: Swap Gemini for OpenAI or PostgreSQL for MongoDB without changing core logic
4. **Maintainability**: Clear separation makes code easier to understand and modify

### Layer Responsibilities

#### Domain Layer (Core)
- **Entities**: `Evaluation`, `EvaluationRequest`
  - Pure business objects with validation
  - No external dependencies
  - Business rules and constraints

- **Repository Interfaces**: `IEvaluationRepository`, `IAIService`
  - Define contracts (ports)
  - Implemented by infrastructure adapters

#### Application Layer
- **Use Cases**: Business workflows
  - `EvaluateVideoUseCase`: Orchestrates video evaluation
  - `StoreEvaluationUseCase`: Handles evaluation storage
  - `GetEvaluationHistoryUseCase`: Retrieves history

- Depends only on domain layer
- No knowledge of HTTP, databases, or external APIs

#### Infrastructure Layer (Adapters)
- **AI Adapter**: `GeminiAIService`
  - Implements `IAIService` interface
  - Handles Gemini API integration
  - Can be swapped with OpenAI adapter

- **Database Adapter**: `PostgresEvaluationRepository`
  - Implements `IEvaluationRepository` interface
  - Handles PostgreSQL operations
  - Can be swapped with MongoDB adapter

- **Auth Adapter**: `JWTAuthMiddleware`
  - Handles JWT verification
  - Optional authentication

#### API Layer (HTTP Interface)
- **Controllers**: Handle HTTP requests/responses
- **Routes**: Define URL endpoints
- **Middleware**: Error handling, logging

### Dependency Injection Flow

```javascript
// 1. Create infrastructure adapters
const aiService = new GeminiAIService();
const repository = new PostgresEvaluationRepository(dbConfig);

// 2. Inject into use cases
const evaluateUseCase = new EvaluateVideoUseCase(aiService, repository);
const storeUseCase = new StoreEvaluationUseCase(repository);

// 3. Inject into controllers
const controller = new EvaluationController(
  evaluateUseCase,
  storeUseCase,
  getHistoryUseCase
);

// 4. Wire up routes
const routes = createEvaluationRoutes(controller, jwtMiddleware);
```

## 🔄 Migration from Monolith

This service extracts evaluation logic from `server/index.js`.

### Key Differences

**Old (Monolithic)**:
- Single file with 760 lines
- Direct database queries in routes
- Gemini API calls mixed with business logic
- Hard to test, hard to modify

**New (Microservice)**:
- Modular architecture with clear layers
- 15+ files, each with single responsibility
- Testable components with dependency injection
- Easy to swap implementations

### Backward Compatibility

The service maintains backward compatibility:
- Same endpoint paths (with and without `/api` prefix)
- Same request/response formats
- Optional JWT authentication (doesn't break existing clients)

## 🚧 Future Enhancements

### Phase 2.1: Async Processing
- Add job queue (BullMQ/Redis)
- Background evaluation processing
- Webhook notifications for completion

### Phase 2.2: API Key Management
- Integrate with auth service for encrypted API keys
- Automatic key retrieval from database
- No need for users to pass API key

### Phase 2.3: Caching
- Cache evaluation results
- Redis for frequently accessed data
- Reduce database load

### Phase 2.4: Monitoring
- Add metrics (Prometheus)
- Distributed tracing (OpenTelemetry)
- Logging aggregation (ELK stack)

## 🛠️ Development

### Code Style
- ES Modules (import/export)
- Async/await for asynchronous operations
- Descriptive variable names
- Comprehensive error handling

### Adding a New Endpoint

1. **Add Use Case** (if needed):
```javascript
// src/application/use-cases/NewUseCase.js
export class NewUseCase {
  constructor(repository) {
    this.repository = repository;
  }
  
  async execute(params) {
    // Business logic here
  }
}
```

2. **Add Controller Method**:
```javascript
// src/api/controllers/EvaluationController.js
async newEndpoint(req, res) {
  const result = await this.newUseCase.execute(req.body);
  return res.json(result);
}
```

3. **Add Route**:
```javascript
// src/api/routes/evaluationRoutes.js
router.post('/new-endpoint', (req, res) => 
  controller.newEndpoint(req, res)
);
```

4. **Wire Up in index.js**:
```javascript
this.newUseCase = new NewUseCase(this.repository);
this.controller = new EvaluationController(
  this.evaluateVideoUseCase,
  this.storeEvaluationUseCase,
  this.getEvaluationHistoryUseCase,
  this.newUseCase  // Add here
);
```

## 📝 License

MIT

## 👥 Authors

Navgurukul Team
