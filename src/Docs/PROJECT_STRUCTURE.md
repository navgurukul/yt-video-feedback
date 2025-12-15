# 📚 Project Structure Documentation

## 🎯 Overview

This document describes the architecture of the YouTube Video Feedback application with **separate frontend and backend deployments**. The project follows modern industry standards with clear separation of concerns, independent packaging, and modular design optimized for cloud deployment.

## 📂 Directory Structure

```
yt-video-feedback/
├── Frontend (Root Level)
│   ├── package.json              # Frontend dependencies ONLY
│   ├── vite.config.ts            # Vite build configuration
│   ├── tailwind.config.ts        # Tailwind CSS config
│   ├── .env                      # Frontend environment variables
│   │
│   ├── src/                      # Frontend source code
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── AnimatedHeading.tsx
│   │   │   ├── AnimatedIntroText.tsx
│   │   │   ├── ApiKeyModal.tsx  # NEW: API key input
│   │   │   ├── AuthGate.tsx     # Authentication guard
│   │   │   ├── CelebrationEffect.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MotionWrapper.tsx
│   │   │
│   │   ├── pages/              # Route pages
│   │   │   ├── Index.tsx        # Landing page
│   │   │   ├── VideoAnalyzer.tsx # Main evaluation page
│   │   │   ├── AnalysisResults.tsx
│   │   │   ├── History.tsx
│   │   │   └── NotFound.tsx
│   │   │
│   │   ├── data/               # Static data and prompts
│   │   │   ├── prompt.ts       # AI evaluation prompts
│   │   │   ├── RubricData.ts   # Evaluation rubrics
│   │   │   └── videoData.ts    # Video metadata
│   │   │
│   │   ├── types/              # TypeScript type definitions
│   │   │   ├── evaluation.ts
│   │   │   └── components.ts
│   │   │
│   │   ├── hooks/              # Custom React hooks
│   │   │   └── use-toast.ts
│   │   │
│   │   ├── integrations/       # Third-party integrations
│   │   │   └── supabase/
│   │   │       ├── client.ts   # Supabase client
│   │   │       └── types.ts
│   │   │
│   │   ├── lib/                # Utility libraries
│   │   │   └── utils.ts
│   │   │
│   │   └── App.tsx             # Main React app with ApiKeyContext
│   │
│   └── public/                  # Static assets
│
└── Backend (server/)
    ├── package.json             # Backend dependencies ONLY
    ├── .env                     # Backend environment variables
    ├── .gitignore               # Backend-specific ignores
    ├── README.md                # Backend deployment guide
    │
    ├── index.js                 # Entry point
    │
    ├── config/                  # Configuration modules
    │   ├── database.js         # PostgreSQL connection pool
    │   └── gemini.js           # Google Gemini AI client
    │
    ├── controllers/             # Request handlers
    │   ├── evaluationController.js  # Video evaluation endpoints
    │   └── databaseController.js    # Database CRUD operations
    │
    ├── services/                # Business logic layer
    │   ├── geminiService.js    # AI evaluation service
    │   └── databaseService.js  # Database operations
    │
    ├── routes/                  # API route definitions
    │   └── api.js              # All API endpoints
    │
    └── migrations/              # Database migration scripts
```

## 🏗️ Architecture Overview

### Separate Deployment Model

The application is designed for **independent deployments**:

1. **Frontend**: Static site hosted on Vercel/Netlify/Cloudflare Pages
2. **Backend**: Node.js API server on Railway/Render/AWS EC2
3. **Database**: PostgreSQL on Railway/AWS RDS/DigitalOcean

### Backend Architecture

The backend follows a **layered architecture** pattern:

```
Routes → Controllers → Services → Database/External APIs
```

#### 1. **Configuration Layer** (`server/config/`)
- **Purpose**: Centralized configuration management
- **Files**:
  - `database.js`: PostgreSQL connection pool with error handling
  - `gemini.js`: Google Gemini AI client initialization

#### 2. **Routes Layer** (`server/routes/`)
- **Purpose**: API endpoint definitions
- **File**: `api.js`
- **Endpoints**:
  - `POST /evaluate` - Evaluate video with AI (accepts user API key)
  - `POST /store-evaluation` - Store results in database
  - `GET /concept-history` - Fetch concept evaluations
  - `GET /project-history` - Fetch project evaluations
  - `GET /concept-evaluation/:id` - Get specific concept evaluation
  - `GET /project-evaluation/:id` - Get specific project evaluation
  - `DELETE /concept-evaluation/:id` - Delete concept evaluation
  - `DELETE /project-evaluation/:id` - Delete project evaluation
  - `GET /health` - Health check endpoint

#### 3. **Controllers Layer** (`server/controllers/`)
- **Purpose**: Request/response handling and validation
- **Files**:
  - `evaluationController.js`: Handles video evaluation requests, extracts API key from request
  - `databaseController.js`: Handles database CRUD operations

#### 4. **Services Layer** (`server/services/`)
- **Purpose**: Core business logic
- **Files**:
  - `geminiService.js`: AI evaluation using Google Gemini
    - Streaming response handling
    - JSON parsing and validation
    - Error handling
  - `databaseService.js`: Database operations
    - Concept evaluation storage/retrieval
    - Project evaluation storage/retrieval
    - Evaluation parsing (supports multiple formats)

### Frontend Architecture

The frontend uses a **component-based architecture** with React:

#### 1. **Components** (`src/components/`)
- **Reusable UI components** with consistent animation and styling
- **Key Components**:
  - `ApiKeyModal`: NEW - Accepts Gemini API key from user
  - `AuthGate`: Authentication guard with API key modal trigger
  - `MotionWrapper`: Configurable animation wrapper
  - `AnimatedHeading`: Animated headings with hover effects
  - `AnimatedIntroText`: Dramatic intro text animations
  - `CelebrationEffect`: Success celebration animations
  - `Header`: Navigation with authentication
  - `Footer`: Social links and copyright

#### 2. **Pages** (`src/pages/`)
- **Route-level components** representing full pages
- **Key Pages**:
  - `Index`: Landing page with hero section
  - `VideoAnalyzer`: Video upload and evaluation interface (uses ApiKeyContext)
  - `AnalysisResults`: Display evaluation results with detailed feedback
  - `History`: View past evaluations

#### 3. **Type Definitions** (`src/types/`)
- **Centralized TypeScript types** for type safety
- **Files**:
  - `evaluation.ts`: Evaluation data structures
  - `components.ts`: Component prop types

#### 4. **Data** (`src/data/`)
- **Static configuration and prompts**
- **Files**:
  - `prompt.ts`: AI prompts and configs
  - `RubricData.ts`: Evaluation rubrics
  - `videoData.ts`: Video metadata

## 🔄 Data Flow

### Video Evaluation Flow

```
1. User authenticates → AuthGate checks for API key
2. If no API key → ApiKeyModal appears
3. User enters API key → Stored in ApiKeyContext + localStorage
4. User uploads video → VideoAnalyzer component
5. VideoAnalyzer includes API key in request → POST /evaluate
6. evaluationController validates request and uses user's API key
7. geminiService calls Gemini AI with user's key
8. Gemini returns evaluation → Response to frontend
9. AnalysisResults displays feedback
10. User saves → POST /store-evaluation
11. databaseController routes by type (concept/project)
12. databaseService stores to PostgreSQL
```

### API Key Management Flow

```
1. User logs in (Google OAuth via Supabase)
2. AuthGate detects SIGNED_IN event
3. Check if API key exists in ApiKeyContext
4. If no key → Show ApiKeyModal (blocking)
5. User enters key → Validate format (starts with AIza)
6. Store in React state + localStorage
7. Key persists across page refreshes
8. All API calls include user's key
9. Backend prioritizes user key over env variable
```

## 📦 Package Management

### Frontend Package (`package.json`)

**Dependencies** (React ecosystem only):
- React, React DOM, React Router
- Vite (build tool)
- TypeScript
- Tailwind CSS, shadcn/ui components
- Framer Motion (animations)
- Supabase client (authentication)
- @tanstack/react-query

**Scripts**:
```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

### Backend Package (`server/package.json`)

**Dependencies** (Server only):
- Express (web framework)
- @google/genai (Gemini AI)
- pg (PostgreSQL client)
- cors
- dotenv
- node-fetch

**Scripts**:
```json
{
  "start": "node index.js",
  "dev": "node --watch index.js"
}
```

## 🌐 Environment Variables

### Frontend (`.env`)

```env
# Supabase Authentication
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJxxx...

# Backend API URLs
VITE_API_URL=https://api.yourdomain.com
VITE_EVAL_API_URL=https://api.yourdomain.com
```

### Backend (`server/.env`)

```env
# Optional fallback if user doesn't provide API key
GEMINI_API_KEY=AIzaSyXxx...

# PostgreSQL Database
PG_HOST=your_database_host
PG_PORT=5432
PG_USER=your_database_user
PG_PASSWORD=your_database_password
PG_DATABASE=your_database_name
PG_SSL=true

# Server Port
PORT=3001
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase project (for authentication)
- Google Gemini API key (users provide their own)

### Development Setup

#### 1. Install Frontend Dependencies
```bash
npm install
```

#### 2. Install Backend Dependencies
```bash
cd server
npm install
cd ..
```

#### 3. Configure Environment Variables

Create `.env` in root:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_key
VITE_API_URL=http://localhost:3001
VITE_EVAL_API_URL=http://localhost:3001
```

Create `server/.env`:
```env
GEMINI_API_KEY=your_fallback_key
PG_HOST=localhost
PG_PORT=5432
PG_USER=your_user
PG_PASSWORD=your_password
PG_DATABASE=your_database
PG_SSL=false
PORT=3001
```

#### 4. Run Development Servers

**Terminal 1 - Backend**:
```bash
cd server
npm start
```

**Terminal 2 - Frontend**:
```bash
npm run dev
```

Frontend runs on `http://localhost:8080`  
Backend runs on `http://localhost:3001`

## 📊 Database Schema

### Concept Evaluations Table
```sql
tbl_ailabs_ytfeedback_concept_evaluations
- id (serial, primary key)
- email (varchar)
- project_name (varchar)
- page_name (varchar)
- video_url (text)
- concept_explanation_accuracy (numeric)
- concept_explanation_feedback (text) -- JSON string
- ability_to_explain_evaluation (text)
- ability_to_explain_feedback (text) -- JSON string
- created_at (timestamp)
```

### Project Evaluations Table
```sql
tbl_ailabs_ytfeedback_project_evaluation
- id (serial, primary key)
- email (varchar)
- project_name (varchar)
- video_url (text)
- project_explanation_evaluation (text)
- project_explanation_feedback (text)
- project_explanation_evaluationjson (text) -- Full JSON
- created_at (timestamp)
```

## 🎨 Design System

The application uses a **neobrutalist design** system:

- **Bold Colors**: High contrast primary/secondary colors
- **Thick Borders**: 4px borders on all major elements
- **Dramatic Shadows**: `shadow-brutal` classes for depth
- **Animated Interactions**: Framer Motion for smooth transitions
- **Responsive**: Mobile-first approach

## 📈 Performance Considerations

- **Connection Pooling**: PostgreSQL pool prevents connection exhaustion
- **Streaming Responses**: AI responses use streaming for faster feedback
- **Lazy Loading**: Components load on demand
- **Code Splitting**: Vite automatically splits code by route
- **Caching**: Browser caching for static assets
- **API Key Management**: User-provided keys reduce server costs

## 🔒 Security Best Practices

- ✅ User-provided API keys (not stored in database)
- ✅ API keys in localStorage (client-side only)
- ✅ Backend prioritizes user keys over environment variables
- ✅ Input validation in controllers
- ✅ SQL injection prevention via parameterized queries
- ✅ CORS configured for specific origins
- ✅ Supabase authentication for user management
- ✅ SSL required for database connections

## 🐛 Troubleshooting

### Frontend Issues

1. **API Key modal keeps appearing**
   - Check localStorage for `gemini_api_key`
   - Verify ApiKeyContext is wrapping routes
   - Check browser console for errors

2. **API calls failing**
   - Verify backend server is running
   - Check `VITE_API_URL` environment variable
   - Inspect network tab in browser DevTools

### Backend Issues

1. **Database connection fails**
   - Check PostgreSQL credentials in `server/.env`
   - Verify SSL settings
   - Ensure database server allows connections

2. **Gemini API errors**
   - User needs to provide valid API key
   - Check quota limits on user's Gemini account
   - Verify video URL is accessible

## 📝 Code Standards

### Naming Conventions

- **Files**: 
  - React components: `PascalCase.tsx`
  - Services/utilities: `camelCase.js`
- **Functions**: `camelCase`
- **Components**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Code Organization

- **Single Responsibility**: Each module has one clear purpose
- **DRY Principle**: No code duplication
- **Separation of Concerns**: Clear boundaries between layers
- **Error Handling**: Comprehensive try-catch with logging
- **Type Safety**: TypeScript for frontend, JSDoc for backend

## 📚 Additional Resources

- [Deployment Guide](../../DEPLOYMENT.md)
- [Frontend README](../../README.md)
- [Backend README](../../server/README.md)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Supabase Documentation](https://supabase.com/docs)

## 🤝 Contributing

When adding new features:

1. Follow existing file structure
2. Add JSDoc comments to all functions
3. Create types in `src/types/` if needed
4. Update documentation if adding new modules
5. Test thoroughly before committing
6. Ensure separate deployments still work

---

**Last Updated**: December 2024  
**Version**: 2.0.0 (Separate Deployment Architecture)
