# 📚 Project Structure Documentation

## 🎯 Overview

This document describes the refactored architecture of the Neo Feedback Hub application. The project has been restructured to follow modern industry standards with clear separation of concerns, comprehensive documentation, and modular design.

## 📂 Directory Structure

```
neo-feedback-hub-07936/
├── server/                    # Backend API Server
│   ├── config/               # Configuration modules
│   │   ├── database.js      # PostgreSQL connection pool
│   │   └── gemini.js        # Google Gemini AI client
│   ├── controllers/          # Request handlers
│   │   ├── evaluationController.js   # Video evaluation endpoints
│   │   └── databaseController.js     # Database CRUD operations
│   ├── services/             # Business logic layer
│   │   ├── geminiService.js         # AI evaluation service
│   │   └── databaseService.js       # Database operations
│   ├── routes/               # API route definitions
│   │   └── api.js           # All API endpoints
│   ├── utils/                # Utility functions (future)
│   ├── migrations/           # Database migration scripts
│   ├── index.js             # Legacy monolithic server (deprecated)
│   └── index-new.js         # New modular entry point
│
├── src/                      # Frontend React Application
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── AnimatedHeading.tsx
│   │   ├── AnimatedIntroText.tsx
│   │   ├── CelebrationEffect.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   └── MotionWrapper.tsx
│   ├── pages/              # Route pages
│   │   ├── AnalysisResults.tsx
│   │   ├── History.tsx
│   │   ├── Index.tsx
│   │   ├── NotFound.tsx
│   │   ├── VideoAnalyzer.tsx
│   │   └── YoutubeFeedback.tsx
│   ├── data/               # Static data and prompts
│   │   └── prompt.ts       # AI evaluation prompts
│   ├── types/              # TypeScript type definitions
│   │   ├── evaluation.ts   # Evaluation data types
│   │   └── components.ts   # Component prop types
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # Third-party integrations
│   │   └── supabase/
│   ├── lib/                # Utility libraries
│   └── App.tsx             # Main React app
│
├── public/                  # Static assets
├── supabase/               # Supabase configuration
└── Configuration files...
```

## 🏗️ Architecture Overview

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
  - `POST /evaluate` - Evaluate video with AI
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
  - `evaluationController.js`: Handles video evaluation requests
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
  - `VideoAnalyzer`: Video upload and evaluation interface
  - `AnalysisResults`: Display evaluation results with detailed feedback
  - `History`: View past evaluations

#### 3. **Type Definitions** (`src/types/`)
- **Centralized TypeScript types** for type safety
- **Files**:
  - `evaluation.ts`: Evaluation data structures
  - `components.ts`: Component prop types

#### 4. **Data** (`src/data/`)
- **Static configuration and prompts**
- **File**: `prompt.ts`
  - Accuracy evaluation prompt and config
  - Ability to explain prompt and config
  - Project evaluation prompt and config

## 🔄 Data Flow

### Video Evaluation Flow

```
1. User uploads video → VideoAnalyzer component
2. VideoAnalyzer sends request → POST /evaluate
3. evaluationController validates request
4. geminiService processes with AI (streaming)
5. Response returned to frontend
6. AnalysisResults displays feedback
7. User saves → POST /store-evaluation
8. databaseController routes by type (concept/project)
9. databaseService parses and stores to PostgreSQL
```

### Historical Data Flow

```
1. User navigates to History page
2. History component requests → GET /concept-history or GET /project-history
3. databaseController validates email
4. databaseService queries PostgreSQL
5. Results rendered in History component
6. User clicks record → Navigate to AnalysisResults with data
```

## 📝 Code Standards

### Documentation Standards

All code follows **JSDoc** documentation standards:

```javascript
/**
 * @fileoverview Brief file description
 * @module module/path
 */

/**
 * Function description
 * 
 * @param {Type} paramName - Parameter description
 * @returns {Type} Return value description
 * 
 * @example
 * exampleFunction('example');
 */
```

### Naming Conventions

- **Files**: 
  - React components: `PascalCase.tsx` (e.g., `VideoAnalyzer.tsx`)
  - Services/utilities: `camelCase.js` (e.g., `geminiService.js`)
  - Configuration: `camelCase.js` or `kebab-case.ts`
- **Functions**: `camelCase` (e.g., `evaluateVideo`)
- **Components**: `PascalCase` (e.g., `AnimatedHeading`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `GEMINI_MODEL`)

### Code Organization

- **Single Responsibility**: Each module has one clear purpose
- **DRY Principle**: No code duplication
- **Separation of Concerns**: Clear boundaries between layers
- **Error Handling**: Comprehensive try-catch with logging
- **Type Safety**: TypeScript for frontend, JSDoc for backend

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- PostgreSQL database
- Google Gemini API key
- Supabase account (for authentication)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
PG_HOST=your_host
PG_PORT=5432
PG_USER=your_user
PG_PASSWORD=your_password
PG_DATABASE=your_database
PG_SSL=false

# API Keys
GEMINI_API_KEY=your_gemini_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key

# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

```bash
# Install dependencies
npm install

# Run development server (frontend + backend)
npm run start

# Or run separately:
npm run dev           # Frontend only
npm run start:api     # Backend only
```

### Database Setup

Run migrations in order:

```bash
# Connect to PostgreSQL and execute:
psql -U your_user -d your_database -f server/migrations/001_create_video_evaluations_table.sql
```

## 🔧 Migration from Legacy Code

### Switching to New Server

To use the new modular server:

1. Update `package.json`:
```json
"scripts": {
  "start:api": "node server/index-new.js"
}
```

2. Restart the server:
```bash
npm run start:api
```

### Benefits of New Structure

- ✅ **Maintainability**: Easier to locate and update code
- ✅ **Testability**: Services can be tested independently
- ✅ **Scalability**: Easy to add new features
- ✅ **Readability**: Clear documentation and structure
- ✅ **Debugging**: Isolated components simplify troubleshooting

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

## 🧪 Testing Strategy

### Recommended Testing Approach

1. **Unit Tests**: Test services independently
   - `geminiService.evaluateVideoWithGemini()`
   - `databaseService.storeConceptEvaluation()`

2. **Integration Tests**: Test controller → service flow
   - POST /evaluate endpoint
   - Database storage and retrieval

3. **E2E Tests**: Test complete user flows
   - Upload video → View results → Save to history
   - Load from history → View details

## 📈 Performance Considerations

- **Connection Pooling**: PostgreSQL pool prevents connection exhaustion
- **Streaming Responses**: AI responses use streaming for faster feedback
- **Lazy Loading**: Components load on demand
- **Code Splitting**: Vite automatically splits code by route
- **Caching**: Browser caching for static assets

## 🔒 Security Best Practices

- ✅ API keys stored in environment variables
- ✅ Input validation in controllers
- ✅ SQL injection prevention via parameterized queries
- ✅ CORS configured for specific origins
- ✅ Supabase authentication for user management

## 🐛 Debugging Tips

### Backend Debugging
- Check console logs with emoji prefixes (✓, ✗, →, ⚠)
- Use PostgreSQL query logs: `pgPool.query()` logs all queries
- Test endpoints with curl or Postman

### Frontend Debugging
- React DevTools for component inspection
- Redux DevTools for state management (if added)
- Network tab for API requests
- Console logs in evaluation flow

## 📚 Additional Resources

- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🤝 Contributing

When adding new features:

1. Follow existing file structure
2. Add JSDoc comments to all functions
3. Create types in `src/types/` if needed
4. Update this README if adding new modules
5. Test thoroughly before committing

## 📝 License

© 2024 NG YT VIDEO FEEDBACK. All rights reserved.

---

**Last Updated**: December 2024  
**Version**: 2.0.0 (Refactored Architecture)
