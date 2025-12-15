# Phase 1: Setup Checklist

Use this checklist to ensure everything is configured correctly before running the application.

## Pre-Setup

- [ ] PostgreSQL database is running and accessible
- [ ] Node.js 18+ is installed
- [ ] Git repository is cloned

## Database Setup

- [ ] Run migration: `services/auth-service/migrations/001_create_users_table.sql`
  ```bash
  psql -h your-host -U your-user -d your-database \
    -f services/auth-service/migrations/001_create_users_table.sql
  ```
- [ ] Verify `users` table exists:
  ```bash
  psql -h your-host -U your-user -d your-database \
    -c "\d users"
  ```

## Auth Service Configuration

- [ ] Navigate to auth service: `cd services/auth-service`
- [ ] Copy environment template: `cp .env.example .env`
- [ ] Generate JWT secret:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Generate encryption key:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Edit `.env` with:
  - [ ] `AUTH_SERVICE_PORT` (default: 3001)
  - [ ] `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_SSL`
  - [ ] `JWT_SECRET` (use generated secret)
  - [ ] `ENCRYPTION_KEY` (use generated key)
  - [ ] `CORS_ORIGIN` (default: http://localhost:3000)
- [ ] Install dependencies: `npm install`
- [ ] Test start: `npm start`
- [ ] Verify health check:
  ```bash
  curl http://localhost:3001/auth/health
  ```

## Frontend Configuration

- [ ] Navigate to root directory: `cd ../..`
- [ ] Copy environment template: `cp .env.example .env` (if not exists)
- [ ] Edit `.env` and add/update:
  - [ ] `VITE_AUTH_SERVICE_URL=http://localhost:3001`
  - [ ] `VITE_SUPABASE_URL` (your Supabase project URL)
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` (your Supabase key)
  - [ ] `VITE_EVAL_API_URL` (evaluation service URL, e.g., http://localhost:3003)

## Evaluation Service Configuration (Existing Backend)

- [ ] Navigate to server directory: `cd server`
- [ ] Verify `.env` exists with:
  - [ ] `PORT` (default: 3001, change to 3003 if auth service uses 3001)
  - [ ] `GEMINI_API_KEY` (your Gemini API key, optional if users provide their own)
  - [ ] `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_SSL`
- [ ] Verify dependencies: `npm install` (if needed)

## Running the Application

### Terminal 1: Auth Service
- [ ] Navigate to auth service: `cd services/auth-service`
- [ ] Start service: `npm start`
- [ ] Verify output shows:
  ```
  ✅ Database connected successfully
  🚀 Authentication Service Started
     Port: 3001
  ```

### Terminal 2: Evaluation Service
- [ ] Navigate to server: `cd server`
- [ ] Start service: `npm start`
- [ ] Verify service is running on configured port

### Terminal 3: Frontend
- [ ] Navigate to root: `cd ../..`
- [ ] Start dev server: `npm run dev`
- [ ] Verify frontend runs on http://localhost:3000

## Testing

### Auth Service Health Check
- [ ] Run: `curl http://localhost:3001/auth/health`
- [ ] Expected response:
  ```json
  {
    "success": true,
    "service": "auth-service",
    "status": "healthy",
    "timestamp": "..."
  }
  ```

### Login Flow Test
- [ ] Open browser: http://localhost:3000
- [ ] Click "Sign in with Google"
- [ ] Complete Google OAuth
- [ ] Verify redirect back to app
- [ ] Verify API key modal appears
- [ ] Enter test API key starting with "AIza"
- [ ] Verify modal closes
- [ ] Open browser DevTools → Application → Local Storage
- [ ] Verify `jwt_token` exists
- [ ] Verify `gemini_api_key` exists

### Database Verification
- [ ] Connect to PostgreSQL
- [ ] Query users table:
  ```sql
  SELECT id, email, name, 
         CASE WHEN api_key IS NOT NULL THEN 'encrypted' ELSE 'null' END as api_key_status,
         created_at
  FROM users;
  ```
- [ ] Verify user record exists
- [ ] Verify `api_key` is encrypted (starts with hex characters, contains colons)

### API Key Encryption Test
- [ ] Run curl to get API key:
  ```bash
  curl http://localhost:3001/auth/api-key/your-email@example.com
  ```
- [ ] Verify response contains decrypted API key starting with "AIza"

### JWT Verification Test
- [ ] Copy JWT token from localStorage
- [ ] Run curl:
  ```bash
  curl -X POST http://localhost:3001/auth/verify-token \
    -H "Authorization: Bearer <your-jwt-token>"
  ```
- [ ] Verify response shows `"valid": true`

## Troubleshooting

### Database Connection Issues
- [ ] Verify PostgreSQL is running: `pg_isready -h your-host`
- [ ] Test connection with psql: `psql -h your-host -U your-user -d your-database`
- [ ] Check firewall rules allow connection from your IP
- [ ] Verify SSL setting matches database requirements (`PG_SSL=true/false`)

### Port Conflicts
- [ ] Check what's using port 3001: `lsof -i :3001` (macOS/Linux)
- [ ] Change `AUTH_SERVICE_PORT` in auth service `.env`
- [ ] Update `VITE_AUTH_SERVICE_URL` in frontend `.env`

### JWT Issues
- [ ] Verify `JWT_SECRET` is set in auth service `.env`
- [ ] Ensure `JWT_SECRET` hasn't changed since token was issued
- [ ] Check token expiration (default 7 days)
- [ ] Clear localStorage and log in again

### API Key Decryption Issues
- [ ] Verify `ENCRYPTION_KEY` is set in auth service `.env`
- [ ] Ensure `ENCRYPTION_KEY` hasn't changed since API key was encrypted
- [ ] Check database for `api_key` format: `iv:authTag:encrypted`

### Frontend Not Connecting to Auth Service
- [ ] Verify `VITE_AUTH_SERVICE_URL` in frontend `.env`
- [ ] Check browser console for CORS errors
- [ ] Verify `CORS_ORIGIN` in auth service `.env` matches frontend URL
- [ ] Restart frontend dev server after changing `.env`

## Security Checklist

- [ ] `JWT_SECRET` is strong (32+ character random string)
- [ ] `ENCRYPTION_KEY` is strong (32+ character random string)
- [ ] Secrets are different from example values
- [ ] `.env` files are in `.gitignore` (not committed to git)
- [ ] Database password is strong
- [ ] PostgreSQL SSL is enabled (`PG_SSL=true`)
- [ ] CORS origin is set to specific domain (not `*` in production)

## Production Deployment Checklist

- [ ] Generate new secrets for production
- [ ] Use environment variable service (AWS Secrets Manager, etc.)
- [ ] Enable HTTPS for all services
- [ ] Set up database connection pooling (already configured: 20 max)
- [ ] Configure health check monitoring
- [ ] Set up logging aggregation
- [ ] Enable database backups
- [ ] Set `NODE_ENV=production`
- [ ] Use process manager (PM2, systemd)
- [ ] Set up reverse proxy (nginx, Cloudflare)

## Documentation Review

- [ ] Read `PHASE1_README.md` for overview
- [ ] Read `PHASE1_SETUP_GUIDE.md` for detailed instructions
- [ ] Read `PHASE1_IMPLEMENTATION_SUMMARY.md` for technical details
- [ ] Read `services/auth-service/README.md` for API documentation

## Support Contacts

If you get stuck:
1. Check the troubleshooting sections in documentation
2. Review auth service logs (terminal running auth service)
3. Check browser console (F12 → Console)
4. Review database logs
5. Check Network tab in DevTools for failed requests

---

**Last Updated**: December 15, 2024  
**Status**: Phase 1 Complete ✅  
**Next**: Phase 2 - Evaluation Service Extraction
