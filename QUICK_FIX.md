# 🔧 Quick Fix: Database Configuration Issue

## The Problem

The Auth Service is trying to connect to `your_database_host` (placeholder) instead of a real database.

## Solution Options

### Option 1: Use the Setup Wizard (Recommended)

Run the interactive setup wizard:

```bash
./setup-env.sh
```

This will:
- ✅ Prompt you for database credentials
- ✅ Generate JWT and encryption secrets automatically
- ✅ Update all `.env` files
- ✅ Test database connection

### Option 2: Copy from Existing Configuration

If you already have working credentials in `server/.env`:

```bash
./setup-env.sh
# Then choose option 3: "Use existing server/.env credentials"
```

### Option 3: Manual Configuration

Edit `services/auth-service/.env`:

```bash
nano services/auth-service/.env
```

Replace these lines with your actual database credentials:
```env
PG_HOST=your-actual-host  # e.g., db-pg.cosodeda78lq.ap-south-1.rds.amazonaws.com
PG_PORT=5432
PG_USER=your-actual-user
PG_PASSWORD=your-actual-password
PG_DATABASE=your-actual-database
PG_SSL=true
```

Also generate and add secrets:
```bash
# Generate JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate encryption key
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and add to `services/auth-service/.env`.

### Option 4: Skip Auth Service for Now

If you just want to test the evaluation service without authentication:

```bash
# Start only evaluation service and frontend
cd server && npm start &
cd .. && npm run dev
```

## After Fixing Configuration

1. **Run database migration** (one time):
   ```bash
   psql -h your-host -U your-user -d your-database \
     -f services/auth-service/migrations/001_create_users_table.sql
   ```

2. **Start all services**:
   ```bash
   ./start-all.sh
   ```

## Verify It Works

```bash
# Should return healthy status
curl http://localhost:3001/auth/health
```

Expected response:
```json
{
  "success": true,
  "service": "auth-service",
  "status": "healthy"
}
```

## Still Having Issues?

Check the logs:
```bash
tail -f logs/auth-service.log
```

Common issues:
- **ENOTFOUND**: Wrong hostname or DNS issue
- **ECONNREFUSED**: Database not running or wrong port
- **Authentication failed**: Wrong username/password
- **SSL error**: Set `PG_SSL=false` or fix SSL certificate

---

**Quick Start**: Run `./setup-env.sh` and follow the prompts!
