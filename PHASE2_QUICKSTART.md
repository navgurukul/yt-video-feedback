# Quick Start: Phase 2 Evaluation Service

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies

```bash
cd services/evaluation-service
npm install
```

### Step 2: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

Required configuration:
```env
PORT=3003
PG_HOST=your_database_host
PG_USER=your_database_user
PG_PASSWORD=your_database_password
PG_DATABASE=your_database_name
JWT_SECRET=your-jwt-secret-from-auth-service
```

### Step 3: Run the Service

```bash
# From services/evaluation-service directory
npm start

# Or from project root
npm run start:evaluation-service
```

## ✅ Verify It's Working

```bash
# Test health endpoint
curl http://localhost:3003/api/health

# Expected response:
# {"status":"healthy","service":"evaluation-service","timestamp":"..."}
```

## 🔄 Run All Services

```bash
# Terminal 1: Auth Service (Port 3001)
npm run start:auth-service

# Terminal 2: Evaluation Service (Port 3003)
npm run start:evaluation-service

# Terminal 3: Frontend (Port 8080)
npm run dev
```

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Port 8080)                   │
│                  React + TypeScript                     │
└────────────────┬────────────────────────────────────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
     ▼                       ▼
┌─────────────┐      ┌──────────────────┐
│Auth Service │      │Evaluation Service│
│  Port 3001  │      │    Port 3003     │
│             │      │                  │
│ - JWT Auth  │      │ - Gemini AI      │
│ - User DB   │      │ - Video Eval     │
│ - API Keys  │      │ - History        │
└─────────────┘      └──────────────────┘
       │                      │
       └──────────┬───────────┘
                  ▼
          ┌──────────────┐
          │  PostgreSQL  │
          │   Database   │
          └──────────────┘
```

## 🧪 Test Endpoints

### 1. Health Check
```bash
curl http://localhost:3003/api/health
```

### 2. Evaluate Video
```bash
curl -X POST http://localhost:3003/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://youtube.com/watch?v=...",
    "apiKey": "AIza...",
    "evaluationType": "concept",
    "videoDetails": "Test video",
    "promptbegining": "Evaluate...",
    "structuredreturnedconfig": {},
    "userEmail": "test@example.com"
  }'
```

### 3. Get History
```bash
curl "http://localhost:3003/api/concept-history?email=test@example.com"
```

## 🔐 Authentication Options

### Option 1: With JWT Token (Recommended)
```bash
curl -X POST http://localhost:3003/api/evaluate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "videoUrl": "...", "apiKey": "..." }'
```

### Option 2: Without JWT (Backward Compatible)
```bash
curl -X POST http://localhost:3003/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{ "videoUrl": "...", "apiKey": "...", "userEmail": "..." }'
```

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check if port is already in use
lsof -i :3003

# Kill existing process if needed
kill -9 <PID>
```

### Database Connection Error
```bash
# Verify database credentials in .env
# Test PostgreSQL connection
psql -h $PG_HOST -U $PG_USER -d $PG_DATABASE
```

### JWT Verification Failed
```bash
# Make sure JWT_SECRET matches auth service
# Check auth service is running on port 3001
curl http://localhost:3001/auth/health
```

## 📚 More Information

- **Full Documentation**: `services/evaluation-service/README.md`
- **Architecture Details**: `PHASE2_COMPLETE.md`
- **API Reference**: See README for complete API documentation

## 🎯 Next Steps

1. ✅ Service is running
2. Test evaluation endpoint with real video
3. Verify database storage
4. Compare with old monolithic service
5. Deploy to production when ready

## 💡 Tips

- **Development**: Use `npm run dev` for auto-reload
- **Production**: Use `npm start` with proper environment
- **Debugging**: Check console logs for detailed error messages
- **Testing**: Use Postman or curl for API testing

---

**Need Help?** Check the comprehensive README in `services/evaluation-service/README.md`
