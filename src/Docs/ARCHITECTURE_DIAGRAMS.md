# 🏗️ Architecture Diagrams

## System Overview - Separate Deployment Architecture

The application is now designed for **separate frontend and backend deployments** with independent hosting, dependencies, and environment configurations.

### High-Level Architecture

```
┌──────────────────────────────────────────┐
│     FRONTEND (Static Host)               │
│  Vercel / Netlify / Cloudflare Pages    │
│                                          │
│  ├─ React + TypeScript + Vite          │
│  ├─ Supabase Auth (Google OAuth)        │
│  ├─ API Key Management (LocalStorage)   │
│  └─ Separate package.json               │
└──────────────┬───────────────────────────┘
               │ HTTPS REST API
               │ (VITE_API_URL)
               ▼
┌──────────────────────────────────────────┐
│     BACKEND (Server Host)                │
│  Railway / Render / AWS EC2 / Heroku    │
│                                          │
│  ├─ Node.js + Express API               │
│  ├─ Gemini AI Integration               │
│  ├─ PostgreSQL Client                   │
│  └─ Separate package.json (server/)     │
└──────────────┬───────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│  Gemini AI  │  │ PostgreSQL  │
│     API     │  │   Database  │
└─────────────┘  └─────────────┘
```

## Deployment Stack

```
┌────────────────────────────────────────────────────────┐
│                   DEPLOYMENT STACK                     │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Frontend (Static Site)                                │
│  ├─ Hosting: Vercel / Netlify / Cloudflare Pages     │
│  ├─ Build: npm run build → dist/                      │
│  ├─ CDN: Automatic edge distribution                  │
│  ├─ Package: Separate package.json (root)             │
│  └─ Environment Variables:                            │
│     ├─ VITE_SUPABASE_URL                              │
│     ├─ VITE_SUPABASE_PUBLISHABLE_KEY                 │
│     ├─ VITE_API_URL (points to backend)               │
│     └─ VITE_EVAL_API_URL (points to backend)          │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Backend (Node.js API Server)                          │
│  ├─ Hosting: Railway / Render / AWS EC2 / Heroku     │
│  ├─ Runtime: Node.js 18+                              │
│  ├─ Package Manager: npm (separate node_modules)      │
│  ├─ Entry Point: server/index.js                      │
│  ├─ Package: Separate package.json (server/)          │
│  └─ Environment Variables:                            │
│     ├─ GEMINI_API_KEY (optional fallback)             │
│     ├─ PG_HOST, PG_PORT, PG_USER                     │
│     ├─ PG_PASSWORD, PG_DATABASE                       │
│     ├─ PG_SSL=true                                    │
│     └─ PORT=3001                                      │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Database (PostgreSQL)                                 │
│  ├─ Hosting: Railway / AWS RDS / DigitalOcean        │
│  ├─ Version: PostgreSQL 14+                           │
│  ├─ SSL: Required for production                      │
│  └─ Tables:                                           │
│     ├─ tbl_ailabs_ytfeedback_concept_evaluations     │
│     └─ tbl_ailabs_ytfeedback_project_evaluation      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Backend Architecture (Layered Design)

```
Express API Server (server/index.js)
    │
    ├── Routes Layer (server/routes/api.js)
    │   ├─ POST /evaluate
    │   ├─ POST /store-evaluation
    │   ├─ GET /concept-history
    │   ├─ GET /project-history
    │   └─ DELETE /evaluation/:id
    │
    ├── Controllers Layer
    │   ├─ evaluationController.js (Request validation)
    │   └─ databaseController.js (CRUD operations)
    │
    ├── Services Layer
    │   ├─ geminiService.js (AI evaluation logic)
    │   └─ databaseService.js (Database operations)
    │
    └── Config Layer
        ├─ gemini.js (AI client setup)
        └─ database.js (PostgreSQL pool)
```

## Request Flow - Video Evaluation

```
User Action: Upload Video & Click "Analyze"
    │
    ▼
┌─────────────────────────────────────────────┐
│         VideoAnalyzer Component             │
│  - Validates input                          │
│  - Prepares video details & rubric          │
│  - Includes user's API key from context     │
│  - Sends POST /evaluate request             │
└────────────────┬────────────────────────────┘
                 │
                 │ HTTPS to VITE_API_URL
                 ▼
┌─────────────────────────────────────────────┐
│      evaluationController.evaluateVideo     │
│  - Validates videoUrl and API key           │
│  - Uses user API key or fallback            │
│  - Calls geminiService                      │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│   geminiService.evaluateVideoWithGemini     │
│  - Creates Gemini AI client                 │
│  - Builds prompt with video details         │
│  - Calls streaming API                      │
│  - Parses JSON response                     │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│           Google Gemini API                 │
│  - Analyzes video content                   │
│  - Streams back evaluation                  │
│  - Returns structured JSON                  │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│      Response flows back to frontend        │
│  - AnalysisResults displays evaluation      │
│  - User can save to database                │
└─────────────────────────────────────────────┘
```

## API Key Management Flow

```
User Logs In (Google OAuth via Supabase)
    │
    ▼
┌─────────────────────────────────────────────┐
│         AuthGate Component                  │
│  - Detects SIGNED_IN event                  │
│  - Checks if API key exists in context      │
└────────────────┬────────────────────────────┘
                 │
      No API Key │
                 ▼
┌─────────────────────────────────────────────┐
│         ApiKeyModal Component               │
│  - Shows blocking modal                     │
│  - User enters Gemini API key               │
│  - Validates key format (starts with AIza)  │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         App.tsx (ApiKeyContext)             │
│  - Stores key in React state                │
│  - Saves to localStorage                    │
│  - Persists across page refreshes           │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│    VideoAnalyzer sends API key in request   │
│  - Backend uses user's key first            │
│  - Falls back to environment variable       │
└─────────────────────────────────────────────┘
```

## Package Structure - Separate Deployments

```
Root Directory
├── package.json (Frontend dependencies ONLY)
│   ├── React, Vite, TypeScript
│   ├── @radix-ui components
│   ├── Tailwind CSS, Framer Motion
│   ├── Supabase client
│   └── NO backend dependencies
│
├── src/ (Frontend source)
│   ├── components/
│   ├── pages/
│   ├── types/
│   └── App.tsx
│
├── .env (Frontend environment)
│   ├── VITE_SUPABASE_URL
│   ├── VITE_SUPABASE_PUBLISHABLE_KEY
│   ├── VITE_API_URL
│   └─ VITE_EVAL_API_URL
│
└── server/ (Backend directory - SEPARATE)
    ├── package.json (Backend dependencies ONLY)
    │   ├── Express, CORS
    │   ├── @google/genai
    │   ├── pg (PostgreSQL)
    │   ├── dotenv, node-fetch
    │   └── NO frontend dependencies
    │
    ├── index.js (Entry point)
    ├── config/ (Database & AI setup)
    ├── controllers/ (Request handlers)
    ├── services/ (Business logic)
    ├── routes/ (API endpoints)
    │
    └── .env (Backend environment - SEPARATE)
        ├── GEMINI_API_KEY
        ├── PG_HOST, PG_PORT
        ├── PG_USER, PG_PASSWORD
        └── PG_DATABASE, PG_SSL
```

## Component Hierarchy (Frontend)

```
App.tsx (ApiKeyContext Provider)
  │
  ├── AuthGate.tsx
  │     ├── ApiKeyModal (conditional)
  │     └── Children (protected routes)
  │
  ├── Header.tsx
  │
  ├── Routes
  │     │
  │     ├── Index.tsx (Home)
  │     │     ├── AnimatedIntroText
  │     │     ├── AnimatedHeading
  │     │     ├── MotionWrapper
  │     │     └── Footer
  │     │
  │     ├── VideoAnalyzer.tsx
  │     │     ├── Uses ApiKeyContext
  │     │     ├── CelebrationEffect
  │     │     ├── AnimatedHeading
  │     │     └── Footer
  │     │
  │     ├── AnalysisResults.tsx
  │     │     ├── CelebrationEffect
  │     │     └── Footer
  │     │
  │     ├── History.tsx
  │     │     └── Footer
  │     │
  │     └── NotFound.tsx
  │
  └── Footer.tsx
```

## Development vs Production

### Development Mode

```
Frontend (Port 8080)
  │
  └─ Vite Proxy (vite.config.ts)
      ├─ /evaluate → http://localhost:3001
      └─ /store-evaluation → http://localhost:3001

Backend (Port 3001)
  └─ Runs locally: cd server && npm start
```

### Production Mode

```
Frontend (Static CDN)
  │
  └─ Direct API calls to VITE_API_URL
      ├─ /evaluate → https://api.yourdomain.com
      └─ /store-evaluation → https://api.yourdomain.com

Backend (Server Host)
  └─ Deployed independently on Railway/Render/etc
```

## Layer Responsibilities

### Routes Layer
- ✅ Define endpoints
- ✅ Map HTTP methods
- ✅ Connect to controllers
- ❌ NO business logic
- ❌ NO data processing

### Controllers Layer
- ✅ Validate request data
- ✅ Extract API key from request
- ✅ Call appropriate services
- ✅ Format responses
- ✅ Handle HTTP errors
- ❌ NO database queries
- ❌ NO AI calls

### Services Layer
- ✅ Business logic
- ✅ External API calls (Gemini)
- ✅ Data transformation
- ✅ Database operations
- ❌ NO request/response handling

### Config Layer
- ✅ Setup connections
- ✅ Load environment variables
- ✅ Export clients/pools
- ❌ NO business logic

## Security Considerations

### API Key Management
- ✅ Users provide their own Gemini API keys
- ✅ Keys stored in browser localStorage (not database)
- ✅ Keys sent with each API request
- ✅ Backend fallback to env variable (optional)
- ✅ No API keys exposed in frontend code

### Authentication
- ✅ Supabase Google OAuth
- ✅ Protected routes via AuthGate
- ✅ User email for database queries

### Database
- ✅ SSL connections required
- ✅ Parameterized queries (SQL injection prevention)
- ✅ Row-level security policies (optional)

## Deployment Checklist

### Frontend Deployment
- [ ] Build frontend: `npm run build`
- [ ] Deploy `dist/` folder to static host
- [ ] Set environment variables in hosting platform
- [ ] Update Supabase redirect URLs
- [ ] Test authentication flow
- [ ] Verify API calls to backend URL

### Backend Deployment
- [ ] Navigate to server: `cd server`
- [ ] Install dependencies: `npm install`
- [ ] Set all environment variables
- [ ] Test database connection
- [ ] Deploy to server host
- [ ] Verify public URL is accessible
- [ ] Update frontend VITE_API_URL

### Database Setup
- [ ] Create PostgreSQL instance
- [ ] Run migration scripts
- [ ] Enable SSL
- [ ] Configure firewall rules
- [ ] Test connection from backend

---

**Last Updated**: December 2024  
**Version**: 2.0.0 (Separate Deployment Architecture)
