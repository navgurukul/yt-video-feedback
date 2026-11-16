# YouTube Video Feedback - Frontend

React-based frontend application for evaluating YouTube educational videos using AI. Built with Vite, TypeScript, React, and Tailwind CSS.

## 🚀 Features

- Google OAuth authentication via Supabase
- User-provided Gemini API key management
- Dual evaluation system (concept accuracy + ability-to-explain)
- Project walkthrough evaluation with rubrics
- Evaluation history tracking
- Modern UI with shadcn/ui components
- Smooth animations with Framer Motion

## 📋 Prerequisites

- Node.js 18+ installed
- Backend API server running (see server/README.md)
- Supabase project for authentication

## 🛠️ Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key

# Backend API URLs
VITE_API_URL=http://localhost:3001
VITE_EVAL_API_URL=http://localhost:3001
```

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```
Application will run on `http://localhost:8080`

### Build for Production
```bash
npm run build
```
Output will be in `dist/` directory

### Preview Production Build
```bash
npm run preview
```

## 🌐 Deployment

### Deploying to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_API_URL` (your backend API URL)
   - `VITE_EVAL_API_URL` (your backend API URL)

### Deploying to Netlify

1. Build the project:
```bash
npm run build
```

2. Deploy via Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

3. Or connect your GitHub repository in Netlify dashboard:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Add environment variables

### Deploying to AWS Amplify

1. Connect your GitHub repository in AWS Amplify Console

2. Configure build settings:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

3. Add environment variables in Amplify Console

### Deploying to Cloudflare Pages

1. Build the project:
```bash
npm run build
```

2. Deploy via Wrangler:
```bash
npx wrangler pages deploy dist
```

## 📁 Project Structure

```
src/
├── components/          # Reusable React components
│   ├── ui/             # shadcn/ui components
│   ├── AuthGate.tsx    # Authentication guard
│   ├── ApiKeyModal.tsx # API key input modal
│   └── ...
├── pages/              # Route pages
│   ├── Index.tsx       # Landing page
│   ├── VideoAnalyzer.tsx  # Main evaluation page
│   ├── AnalysisResults.tsx # Results display
│   └── History.tsx     # Evaluation history
├── data/               # Static data and configurations
│   ├── RubricData.ts   # Evaluation rubrics
│   ├── videoData.ts    # Video metadata
│   └── prompt.ts       # AI prompts
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client
├── types/              # TypeScript type definitions
└── App.tsx             # Main app component
```

## 🔑 Authentication Setup

### Supabase Configuration

1. Create a Supabase project at https://supabase.com

2. Enable Google OAuth:
   - Go to Authentication > Providers
   - Enable Google provider
   - Add your Google OAuth credentials
   - Set redirect URL: `https://your-domain.com`

3. Configure allowed domains:
   - Add `@navgurukul.org` email domain restriction if needed

## 🎨 Styling

- **UI Framework**: Tailwind CSS with custom brutal shadow design
- **Components**: shadcn/ui primitives
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Theme**: Custom HSL color variables in `src/index.css`

## 🔧 Configuration

### API URL Configuration

The frontend uses environment variables to configure backend API URLs:

- **Development**: Uses Vite proxy (configured in `vite.config.ts`)
- **Production**: Direct API calls to `VITE_API_URL`

### Adding New Video Types

1. Update rubrics in `src/data/RubricData.ts`
2. Add video details in `src/data/videoData.ts`
3. Update evaluation logic in `src/pages/VideoAnalyzer.tsx`

## 🐛 Troubleshooting

### Common Issues

1. **Authentication not working**
   - Check Supabase URL and key
   - Verify redirect URLs in Supabase dashboard
   - Check browser console for errors

2. **API calls failing**
   - Verify backend server is running
   - Check `VITE_API_URL` environment variable
   - Inspect network tab in browser DevTools

3. **Build fails**
   - Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
   - Check for TypeScript errors: `npm run lint`

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🔒 Security Notes

- API keys are stored in browser localStorage
- Authentication handled by Supabase
- HTTPS required for production
- Row-level security policies in PostgreSQL

## 🤝 Development Guidelines

- Follow TypeScript best practices
- Use existing UI components from `src/components/ui/`
- Maintain consistent styling with Tailwind utility classes
- Add animations sparingly using Framer Motion
- Test on multiple screen sizes

## 📝 Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| VITE_SUPABASE_URL | Supabase project URL | Yes | https://xxx.supabase.co |
| VITE_SUPABASE_PUBLISHABLE_KEY | Supabase public key | Yes | eyJxxx... |
| VITE_API_URL | Backend API URL | Yes | https://api.example.com |
| VITE_EVAL_API_URL | Evaluation API URL | Yes | https://api.example.com |

## 🤝 Support

For issues or questions, contact the Navgurukul team.

## Multi-tenant architecture (branch `feat/multi-tenant`)

The tool now serves many institutions (Navgurukul branches, colleges, MBA programs).

- **Roles:** super admin (creates institutions) → institution admin (syllabus, rubrics, prompts, users, Gemini key) → evaluator → student. Access is checked on the server from the Supabase login.
- **Data model:** Institution → Program → Phase → Video assignment, with versioned rubrics and prompt templates. Every evaluation row stores its institution, video, rubric and prompt versions.
- **Prompts are built on the server** from the database (`server/lib/evaluation-request.js`). Navgurukul's prompts are byte-identical to the previous hardcoded ones.
- **Screens:** `/admin` (institution admin) and `/super-admin`.
- **Docs:**
  - `docs/MULTI_TENANT_PLAN.md`: design.
  - `docs/API.md`: endpoints and environment.
  - `docs/ROLLOUT.md`: moving to the main database.
  - `server/scripts/multi-tenant/README.md`: test database scripts and test suites.
- **Database selection:** `server/db.js`, with `DB_TARGET=test|prod|prod-readonly`. Local development uses the TEST database by default.
