# Phase 1: Authentication Service Setup Guide

## Overview
Phase 1 implements a standalone **Authentication Service** using **Hexagonal Architecture** (Clean Architecture). This service handles:
- User authentication with JWT tokens
- Secure API key storage (AES-256-GCM encryption)
- Token verification for protected routes

## Architecture Layers

```
services/auth-service/
├── src/
│   ├── domain/              # Business logic (no dependencies)
│   │   ├── entities/        # User entity
│   │   ├── repositories/    # IUserRepository (port)
│   │   └── services/        # IEncryptionService, ITokenService (ports)
│   ├── application/         # Use cases / business workflows
│   │   └── use-cases/       # AuthenticateUser, ValidateApiKey, VerifyToken, GetUserApiKey
│   ├── infrastructure/      # Adapters (implements ports)
│   │   ├── database/        # Database connection pool
│   │   ├── repositories/    # PostgresUserRepository
│   │   └── services/        # AESEncryptionService, JWTTokenService
│   ├── presentation/        # HTTP layer
│   │   ├── controllers/     # AuthController
│   │   ├── routes/          # Express routes
│   │   └── middleware/      # Auth middleware
│   └── index.js            # Service entry point
├── migrations/             # SQL migrations
├── package.json
├── .env.example
└── README.md
```

## Prerequisites

1. **PostgreSQL Database**: Ensure your database is accessible
2. **Node.js 18+**: Required for running the service
3. **Existing Backend**: The evaluation service at `server/index.js` should still be running

## Installation Steps

### Step 1: Install Auth Service Dependencies

```bash
cd services/auth-service
npm install
```

### Step 2: Configure Environment Variables

Create `.env` file in `services/auth-service/`:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
AUTH_SERVICE_PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database Configuration (same as your existing PG_* vars)
PG_HOST=your-database-host
PG_PORT=5432
PG_USER=your-database-user
PG_PASSWORD=your-database-password
PG_DATABASE=your-database-name
PG_SSL=true

# JWT Configuration (generate strong secrets!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Encryption Configuration (for API keys)
ENCRYPTION_KEY=your-super-secret-encryption-key-change-in-production
```

**Security Note**: Generate strong secrets using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Run Database Migration

Connect to your PostgreSQL database and run the migration:

```bash
psql -h your-database-host -U your-database-user -d your-database-name -f services/auth-service/migrations/001_create_users_table.sql
```

Or using a GUI tool (pgAdmin, DBeaver), execute the SQL in:
- `services/auth-service/migrations/001_create_users_table.sql`

This creates the `users` table with columns:
- `id` (SERIAL PRIMARY KEY)
- `email` (VARCHAR UNIQUE)
- `name` (VARCHAR)
- `supabase_id` (VARCHAR UNIQUE)
- `api_key` (TEXT - encrypted)
- `created_at`, `updated_at` (TIMESTAMP)

### Step 4: Update Frontend Environment

Add to your frontend `.env` (root directory):

```env
# Add this line to existing .env
VITE_AUTH_SERVICE_URL=http://localhost:3001
```

### Step 5: Start the Auth Service

```bash
# In services/auth-service/
npm start

# Or for development with auto-reload:
npm run dev
```

You should see:
```
✅ Database connected successfully
🔧 Initializing dependencies...
⚙️  Configuring middleware...
🛣️  Configuring routes...

🚀 ======================================
   Authentication Service Started
   Port: 3001
   Environment: development
   ======================================
```

### Step 6: Test the Auth Service

**Health Check:**
```bash
curl http://localhost:3001/auth/health
```

Expected response:
```json
{
  "success": true,
  "service": "auth-service",
  "status": "healthy",
  "timestamp": "2024-12-15T..."
}
```

### Step 7: Start Existing Backend (Evaluation Service)

Since auth service is using port 3001, you need to either:

**Option A: Change Auth Service Port**
Edit `services/auth-service/.env`:
```env
AUTH_SERVICE_PORT=3002
```

Update frontend `.env`:
```env
VITE_AUTH_SERVICE_URL=http://localhost:3002
```

**Option B: Change Evaluation Service Port** (Recommended)
Edit `server/.env`:
```env
PORT=3003
```

Update frontend `.env`:
```env
VITE_EVAL_API_URL=http://localhost:3003
```

Then start the evaluation service:
```bash
cd server
npm start
```

### Step 8: Start Frontend

```bash
# In root directory
npm run dev
```

Frontend will run on `http://localhost:3000`

## Testing the Full Flow

1. **Open frontend**: `http://localhost:3000`
2. **Click "Sign in with Google"**: Uses Supabase OAuth
3. **After successful login**:
   - Frontend calls `/auth/login` → Backend creates user + returns JWT
   - JWT stored in localStorage as `jwt_token`
   - API key modal appears
4. **Enter Gemini API key**: Frontend sends to `/auth/api-key`
   - Backend encrypts and stores in `users.api_key` column
5. **Analyze video**:
   - Frontend includes JWT in `Authorization: Bearer <token>` header
   - Backend verifies JWT before processing evaluation

## API Endpoints

### `POST /auth/login`
Authenticate user after Supabase login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "supabaseId": "uuid-from-supabase"
  }'
```

### `POST /auth/api-key`
Store encrypted API key
```bash
curl -X POST http://localhost:3001/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "apiKey": "AIza..."
  }'
```

### `POST /auth/verify-token`
Verify JWT token
```bash
curl -X POST http://localhost:3001/auth/verify-token \
  -H "Authorization: Bearer <your-jwt-token>"
```

### `GET /auth/api-key/:email`
Get decrypted API key (internal use)
```bash
curl http://localhost:3001/auth/api-key/user@example.com
```

## Troubleshooting

### Issue: "Database connection failed"
- Check `PG_*` environment variables in `.env`
- Ensure PostgreSQL is running and accessible
- Verify firewall rules allow connection

### Issue: "Port 3001 already in use"
- Change `AUTH_SERVICE_PORT` in auth service `.env`
- Update `VITE_AUTH_SERVICE_URL` in frontend `.env`

### Issue: "JWT verification failed"
- Ensure `JWT_SECRET` is the same across restarts
- Check that token hasn't expired (default 7 days)

### Issue: "API key decryption failed"
- Ensure `ENCRYPTION_KEY` hasn't changed since encryption
- Check that stored `api_key` format is `iv:authTag:encrypted`

## Architecture Benefits

✅ **Separation of Concerns**: Domain logic isolated from infrastructure
✅ **Testability**: Easy to mock dependencies
✅ **Flexibility**: Swap PostgreSQL for MongoDB without changing domain
✅ **Security**: API keys encrypted at rest using AES-256-GCM
✅ **Scalability**: Stateless JWT authentication enables horizontal scaling

## Next Steps (Phase 2)

Once Phase 1 is stable:
1. Extract Evaluation Service from `server/index.js`
2. Implement async processing with RabbitMQ/Redis
3. Frontend polling for evaluation results
4. Event-driven communication between services

## File Checklist

- ✅ Domain entities: `User.js`
- ✅ Domain ports: `IUserRepository.js`, `IEncryptionService.js`, `ITokenService.js`
- ✅ Application use cases: `AuthenticateUser.js`, `ValidateApiKey.js`, `VerifyToken.js`, `GetUserApiKey.js`
- ✅ Infrastructure adapters: `PostgresUserRepository.js`, `AESEncryptionService.js`, `JWTTokenService.js`
- ✅ Presentation layer: `AuthController.js`, `authRoutes.js`, `authMiddleware.js`
- ✅ Entry point: `index.js`
- ✅ Database migration: `001_create_users_table.sql`
- ✅ Frontend integration: `authService.ts`, updated `App.tsx`, `AuthGate.tsx`, `VideoAnalyzer.tsx`

## Support

For issues, check:
1. Console logs in browser (F12)
2. Auth service logs (terminal running auth service)
3. PostgreSQL logs (database server)
4. Network tab in DevTools (failed requests)
