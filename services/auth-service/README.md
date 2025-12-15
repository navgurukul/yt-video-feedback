# Auth Service

Authentication microservice built with **Hexagonal Architecture** (Clean Architecture).

## Architecture

```
src/
├── domain/              # Business logic & entities (no dependencies)
│   ├── entities/        # User entity
│   ├── repositories/    # Repository interfaces (ports)
│   └── services/        # Service interfaces (ports)
├── application/         # Use cases / business workflows
│   └── use-cases/       # AuthenticateUser, ValidateApiKey, etc.
├── infrastructure/      # External adapters (DB, encryption, JWT)
│   ├── database/        # Database connection
│   ├── repositories/    # PostgreSQL repository implementation
│   └── services/        # AES encryption, JWT service
└── presentation/        # HTTP layer (controllers, routes)
    ├── controllers/     # AuthController
    ├── routes/          # Express routes
    └── middleware/      # Auth middleware
```

## Features

- ✅ User authentication with JWT
- ✅ Secure API key storage (AES-256-GCM encryption)
- ✅ Token verification
- ✅ Hexagonal Architecture (Domain-driven design)
- ✅ Dependency Injection
- ✅ PostgreSQL with connection pooling

## API Endpoints

### `POST /auth/login`
Authenticate user and generate JWT token
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "supabaseId": "uuid-from-supabase"
}
```

### `POST /auth/api-key`
Store user's Gemini API key (encrypted)
```json
{
  "email": "user@example.com",
  "apiKey": "AIza..."
}
```

### `POST /auth/verify-token`
Verify JWT token
```
Authorization: Bearer <jwt-token>
```

### `GET /auth/api-key/:email`
Get decrypted API key for user (internal use)

### `GET /auth/health`
Health check endpoint

## Environment Variables

See `.env.example` for required configuration:
- `AUTH_SERVICE_PORT`: Service port (default: 3001)
- `PG_*`: PostgreSQL connection details
- `JWT_SECRET`: Secret key for JWT signing
- `ENCRYPTION_KEY`: Key for API key encryption

## Installation

```bash
cd services/auth-service
npm install
```

## Running

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

## Database Setup

Run the migration to create the `users` table:
```sql
-- See migrations/001_create_users_table.sql
```

## Testing

```bash
# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Set API key
curl -X POST http://localhost:3001/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","apiKey":"AIza..."}'

# Verify token
curl -X POST http://localhost:3001/auth/verify-token \
  -H "Authorization: Bearer <your-jwt-token>"
```

## Architecture Benefits

1. **Separation of Concerns**: Domain logic isolated from infrastructure
2. **Testability**: Easy to mock dependencies and test use cases
3. **Flexibility**: Swap implementations (e.g., MongoDB instead of PostgreSQL)
4. **Maintainability**: Clear structure and single responsibility
