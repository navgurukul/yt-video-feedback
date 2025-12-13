# 🔄 Quick Migration Guide

## Switch to New Modular Server in 3 Steps

### Step 1: Update package.json

Replace the old server script with the new one:

```json
{
  "scripts": {
    "start:api": "node server/index-new.js"
  }
}
```

### Step 2: Restart Your Development Server

```bash
# Stop current server (Ctrl+C)

# Restart with new server
npm run start
```

### Step 3: Verify Everything Works

Open your browser and test:
- ✅ Health check: http://localhost:3001/health
- ✅ Upload a video and analyze it
- ✅ Save results to database
- ✅ View history page

## Expected Console Output

You should see:
```
=================================
  Video Evaluation API Server
=================================
✓ Server running on http://localhost:3001
✓ Health check: http://localhost:3001/health
=================================
✓ Connected to PostgreSQL database
✓ GEMINI_KEY loaded from environment (masked): AIza...xyz
```

## Troubleshooting

### Issue: "Cannot find module"
**Solution**: Make sure you're running from the project root directory

### Issue: Database connection error
**Solution**: Check your .env file has correct PG_* variables

### Issue: GEMINI_KEY not configured
**Solution**: Add GEMINI_API_KEY to your .env file

## Rollback (If Needed)

If you need to go back to the old server:

```json
{
  "scripts": {
    "start:api": "node server/index.js"
  }
}
```

## Benefits of New Server

- 🎯 Cleaner code organization
- 📝 Better documentation
- 🐛 Easier debugging
- 🧪 Testable modules
- 📈 Ready for scaling

## Questions?

Check these docs:
- `PROJECT_STRUCTURE.md` - Complete architecture
- `REFACTORING_SUMMARY.md` - What changed
- Server files have JSDoc comments
