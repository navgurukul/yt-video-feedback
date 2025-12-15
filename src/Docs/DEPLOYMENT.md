# Deployment Guide - YouTube Video Feedback Application

This guide covers deploying the frontend and backend separately.

## 🎯 Architecture Overview

```
Frontend (React/Vite)          Backend (Node.js/Express)
     ↓                                  ↓
Static Hosting                    Server Hosting
(Vercel/Netlify)                  (Railway/Render)
     ↓                                  ↓
     └──────── API Calls ──────────────┘
                    ↓
              PostgreSQL Database
```

## 📦 Pre-Deployment Checklist

### Backend
- [ ] PostgreSQL database created and accessible
- [ ] Database tables created (see migrations)
- [ ] Gemini API key obtained (optional)
- [ ] Environment variables prepared
- [ ] CORS configured for frontend domain

### Frontend
- [ ] Supabase project created
- [ ] Google OAuth configured in Supabase
- [ ] Backend API URL ready
- [ ] Environment variables prepared

## 🚀 Backend Deployment

### Option 1: Railway (Recommended)

1. **Create Railway account** at https://railway.app

2. **Create new project** and add PostgreSQL database

3. **Deploy backend**:
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Set root directory: `server`
   - Railway auto-detects Node.js

4. **Configure environment variables**:
   ```
   GEMINI_API_KEY=your_key
   PG_HOST=railway_provided
   PG_PORT=railway_provided
   PG_USER=railway_provided
   PG_PASSWORD=railway_provided
   PG_DATABASE=railway_provided
   PG_SSL=true
   PORT=3001
   ```

5. **Deploy**: Push to main branch, Railway auto-deploys

6. **Get API URL**: Copy the public URL (e.g., `https://your-app.railway.app`)

### Option 2: Render

1. **Create Render account** at https://render.com

2. **Create Web Service**:
   - Connect GitHub repository
   - Set root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`

3. **Add environment variables** in Render dashboard

4. **Create PostgreSQL database** in Render (or use external)

5. **Deploy**: Render auto-deploys on push

### Option 3: AWS EC2

1. **Launch EC2 instance** (Ubuntu 22.04)

2. **SSH into instance**:
   ```bash
   ssh -i your-key.pem ubuntu@your-ip
   ```

3. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Clone repository**:
   ```bash
   git clone https://github.com/navgurukul/yt-video-feedback.git
   cd yt-video-feedback/server
   ```

5. **Install dependencies**:
   ```bash
   npm install
   ```

6. **Create .env file** with production values

7. **Install PM2**:
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name yt-feedback-api
   pm2 startup
   pm2 save
   ```

8. **Configure Nginx** (optional):
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

9. **Setup SSL** with Let's Encrypt:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

## 🌐 Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Configure environment variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_API_URL` (your backend URL)
   - `VITE_EVAL_API_URL` (your backend URL)

4. **Setup custom domain** (optional) in Vercel dashboard

### Option 2: Netlify

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Build project**:
   ```bash
   npm run build
   ```

3. **Deploy**:
   ```bash
   netlify deploy --prod --dir=dist
   ```

4. **Configure environment variables** in Netlify dashboard

5. **Setup custom domain** (optional)

### Option 3: AWS Amplify

1. **Push code to GitHub**

2. **In AWS Amplify Console**:
   - Connect repository
   - Select branch
   - Configure build settings (use provided amplify.yml)

3. **Add environment variables**:
   - Navigate to App Settings → Environment variables
   - Add all VITE_* variables

4. **Deploy**: Amplify auto-builds and deploys

### Option 4: Cloudflare Pages

1. **Build project**:
   ```bash
   npm run build
   ```

2. **Deploy via CLI**:
   ```bash
   npx wrangler pages deploy dist --project-name yt-feedback
   ```

3. **Or connect GitHub** in Cloudflare Pages dashboard:
   - Build command: `npm run build`
   - Build output: `dist`
   - Add environment variables

## 🗄️ Database Setup

### PostgreSQL on Railway

1. Create PostgreSQL database in Railway
2. Get connection details from Railway
3. Run migrations from `supabase/migrations/`

### External PostgreSQL (AWS RDS, DigitalOcean, etc.)

1. Create PostgreSQL instance
2. Enable SSL
3. Create database user
4. Run migration scripts:
   ```bash
   psql -h your-host -U your-user -d your-db -f supabase/migrations/20251104051855_separate_evaluation_tables.sql
   ```

## 🔧 Post-Deployment Configuration

### Update Supabase Redirect URLs

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add production URLs:
   - Site URL: `https://your-frontend-domain.com`
   - Redirect URLs: `https://your-frontend-domain.com/**`

### Update Backend CORS

In `server/index.js`, update CORS for production:
```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

### Test the Deployment

1. **Backend health check**:
   ```bash
   curl https://your-backend-url.com/
   ```

2. **Frontend**:
   - Visit your frontend URL
   - Try logging in with Google
   - Submit a video for evaluation
   - Check evaluation history

## 📊 Monitoring

### Backend Monitoring

- **Railway**: Built-in logs and metrics
- **Render**: Logs tab in dashboard
- **AWS**: CloudWatch logs and metrics

### Frontend Monitoring

- **Vercel**: Analytics and logs
- **Netlify**: Analytics dashboard
- **Cloudflare**: Analytics and logs

## 🔄 CI/CD Setup

### GitHub Actions for Backend

Create `.github/workflows/deploy-backend.yml`:
```yaml
name: Deploy Backend
on:
  push:
    branches: [main]
    paths:
      - 'server/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          # Add your deployment commands
```

### GitHub Actions for Frontend

Create `.github/workflows/deploy-frontend.yml`:
```yaml
name: Deploy Frontend
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## 🐛 Troubleshooting

### Backend Issues

1. **Database connection fails**:
   - Check PostgreSQL credentials
   - Verify SSL settings
   - Check firewall rules

2. **API not responding**:
   - Check server logs
   - Verify PORT environment variable
   - Check health endpoint

### Frontend Issues

1. **API calls failing**:
   - Verify VITE_API_URL is correct
   - Check CORS configuration
   - Inspect browser network tab

2. **Authentication not working**:
   - Check Supabase redirect URLs
   - Verify OAuth credentials
   - Check browser cookies enabled

## 📝 Environment Variables Summary

### Backend (.env)
```env
GEMINI_API_KEY=optional_fallback_key
PG_HOST=database_host
PG_PORT=5432
PG_USER=database_user
PG_PASSWORD=database_password
PG_DATABASE=database_name
PG_SSL=true
PORT=3001
```

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJxxx...
VITE_API_URL=https://your-backend-url.com
VITE_EVAL_API_URL=https://your-backend-url.com
```

## 🎉 Success Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Database connected and migrations run
- [ ] Authentication working (Google OAuth)
- [ ] API key modal appears on first login
- [ ] Video evaluation working
- [ ] Results saving to database
- [ ] History page showing past evaluations
- [ ] Custom domains configured (if applicable)
- [ ] SSL certificates active
- [ ] Monitoring setup
- [ ] Backups configured

## 🤝 Support

For deployment issues, contact the Navgurukul development team.
