# 🚀 Quick Start Guide - Running the Application

## Port Configuration (Already Set Up)

- **Auth Service**: Port `3001`
- **Evaluation Service**: Port `3003` 
- **Frontend**: Port `3000` (or `8080`)

## Option 1: Automated Startup (Recommended)

Run all services with one command:

```bash
./start-all.sh
```

This script will:
- ✅ Check and create `.env` files from templates
- ✅ Check port availability
- ✅ Install dependencies if needed
- ✅ Start all 3 services in background
- ✅ Run health checks
- ✅ Monitor logs

To stop all services:
```bash
./stop-services.sh
```

## Option 2: Manual Startup (3 Terminals)

### Terminal 1: Auth Service
```bash
cd services/auth-service
npm start
```
Should show: `🚀 Authentication Service Started - Port: 3001`

### Terminal 2: Evaluation Service
```bash
cd server
npm start
```
Should show: Server running on port `3003`

### Terminal 3: Frontend
```bash
npm run dev
```
Should show: Server running at `http://localhost:3000` (or `8080`)

## First Time Setup

### 1. Create Environment Files

```bash
# Auth Service
cp services/auth-service/.env.example services/auth-service/.env

# Evaluation Service
cp server/.env.example server/.env

# Frontend
cp .env.example .env
```

### 2. Edit Configuration

**Auth Service** (`services/auth-service/.env`):
```env
AUTH_SERVICE_PORT=3001
PG_HOST=your-database-host
PG_USER=your-database-user
PG_PASSWORD=your-database-password
PG_DATABASE=your-database-name
JWT_SECRET=your-secret-here  # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-key-here  # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Evaluation Service** (`server/.env`):
```env
PORT=3003
PG_HOST=your-database-host
PG_USER=your-database-user
PG_PASSWORD=your-database-password
PG_DATABASE=your-database-name
GEMINI_API_KEY=your-gemini-key  # Optional
```

**Frontend** (`.env`):
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-key
VITE_AUTH_SERVICE_URL=http://localhost:3001
VITE_EVAL_API_URL=http://localhost:3003
```

### 3. Run Database Migration (One Time)

```bash
psql -h your-host -U your-user -d your-database \
  -f services/auth-service/migrations/001_create_users_table.sql
```

### 4. Install Dependencies

```bash
# Auth Service
cd services/auth-service && npm install

# Evaluation Service
cd ../server && npm install

# Frontend
cd .. && npm install
```

## Testing

Once all services are running:

```bash
# Test Auth Service
curl http://localhost:3001/auth/health

# Test Evaluation Service
curl http://localhost:3003/

# Open Frontend
open http://localhost:3000
```

## Troubleshooting

### Port Already in Use

**Find and kill the process:**
```bash
# Find process on port 3001
lsof -ti:3001 | xargs kill -9

# Find process on port 3003
lsof -ti:3003 | xargs kill -9

# Find process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues

1. Verify PostgreSQL is running:
   ```bash
   pg_isready -h your-host
   ```

2. Test connection:
   ```bash
   psql -h your-host -U your-user -d your-database
   ```

3. Check SSL setting in `.env` (PG_SSL=true/false)

### Services Won't Start

Check logs:
```bash
# Auth Service
tail -f logs/auth-service.log

# Evaluation Service
tail -f logs/evaluation-service.log

# Frontend
tail -f logs/frontend.log
```

## Service URLs

Once running:

- **Frontend**: http://localhost:3000
- **Auth API**: http://localhost:3001/auth/health
- **Evaluation API**: http://localhost:3003/

## Development Workflow

```bash
# Start all services
./start-all.sh

# Make changes to code (services auto-restart with nodemon)

# View logs
tail -f logs/*.log

# Stop all services
./stop-services.sh
```

## Production Notes

For production deployment:
1. Generate strong secrets for `JWT_SECRET` and `ENCRYPTION_KEY`
2. Use environment variable services (AWS Secrets Manager, etc.)
3. Enable HTTPS for all services
4. Set `NODE_ENV=production`
5. Use process manager (PM2, systemd)
6. Configure reverse proxy (nginx, Cloudflare)

---

**Need Help?** Check `PHASE1_SETUP_GUIDE.md` for detailed instructions.
