# YouTube Video Feedback - Backend API

Backend API server for the YouTube Video Feedback application. Handles video evaluations using multiple AI models and stores results in PostgreSQL.

## 🚀 Features

- **Multiple AI Models**:
  - Google Gemini AI (2.5 Flash) - Native video analysis
  - Qwen2-VL-7B-Instruct - Multimodal vision-language model
  - Qwen2.5-7B-Instruct - Compact text model
  - Mistral-7B-Instruct - Fast reasoning model
  - Gemma-3-27B - Text-only analysis
- Dual evaluation system for concept videos (accuracy + ability-to-explain)
- Rubric-based evaluation for project videos
- PostgreSQL database integration
- User-provided API key support
- CORS enabled for frontend integration
- Production-ready error handling and retry logic

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL database access
- Google Gemini API key (optional - users can provide via frontend)
- Hugging Face API token (for Qwen2-VL, Qwen, Mistral, Gemma models)

## 🛠️ Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from example:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Optional - fallback if user doesn't provide API key
GEMINI_API_KEY=your_gemini_api_key_here

# PostgreSQL Configuration
PG_HOST=your_database_host
PG_PORT=5432
PG_USER=your_database_user
PG_PASSWORD=your_database_password
PG_DATABASE=your_database_name
PG_SSL=true

# Server Port (default: 3001)
PORT=3001
```

## 🏃 Running the Server

### Development Mode
```bash
npm run dev
```
Server will run on `http://localhost:3001` with auto-reload on file changes.

### Production Mode
```bash
npm start
```

## 📡 API Endpoints

### POST `/evaluate`
Evaluates a YouTube video using Gemini AI.

**Request Body:**
```json
{
  "videoUrl": "https://youtu.be/...",
  "videoDetails": "Video evaluation criteria",
  "promptbegining": "Evaluation prompt",
  "rubric": {...},
  "structuredreturnedconfig": {...},
  "evaluationType": "concept|project|accuracy|ability",
  "apiKey": "optional_user_provided_gemini_key"
}
```

**Response:**
```json
{
  "parsed": {
    // Evaluation results based on rubric
  }
}
```

### POST `/store-evaluation`
Stores evaluation results in PostgreSQL database.

**Request Body:**
```json
{
  "videoUrl": "https://youtu.be/...",
  "evaluationType": "concept|project",
  "evaluationData": {...},
  "userEmail": "user@example.com",
  "selectedPhase": "Phase1",
  "selectedVideoTitle": "Video Title"
}
```

## 🗄️ Database Schema

### Concept Evaluations Table
```sql
tbl_ailabs_ytfeedback_concept_evaluations
- id (SERIAL PRIMARY KEY)
- email (TEXT)
- youtube_video_link (TEXT)
- concept_explanation_accuracy (INT)
- concept_explanation_feedback (TEXT)
- ability_to_explain_evaluation (TEXT)
- ability_to_explain_feedback (TEXT)
- selected_phase (TEXT)
- selected_video_title (TEXT)
- created_at (TIMESTAMP)
```

### Project Evaluations Table
```sql
tbl_ailabs_ytfeedback_project_evaluation
- id (SERIAL PRIMARY KEY)
- email (TEXT)
- youtube_video_link (TEXT)
- project_explanation_evaluationjson (JSONB)
- selected_phase (TEXT)
- created_at (TIMESTAMP)
```

## 🌐 Deployment

### Deploying to Cloud Platforms

#### AWS EC2 / DigitalOcean / Any VPS
1. SSH into your server
2. Clone the repository and navigate to server folder
3. Install dependencies: `npm install`
4. Set up environment variables
5. Install PM2: `npm install -g pm2`
6. Start the server: `pm2 start index.js --name yt-feedback-api`
7. Configure nginx as reverse proxy (optional)

#### Heroku
1. Create a new Heroku app
2. Set environment variables in Heroku dashboard
3. Deploy:
```bash
git subtree push --prefix server heroku main
```

#### Railway / Render
1. Connect your GitHub repository
2. Set root directory to `server`
3. Configure environment variables
4. Deploy automatically on push

### Environment Variables for Production
Ensure these are set in your deployment platform:
- `GEMINI_API_KEY` (optional)
- `PG_HOST`
- `PG_PORT`
- `PG_USER`
- `PG_PASSWORD`
- `PG_DATABASE`
- `PG_SSL`
- `PORT` (usually set automatically)

## � Documentation

### AI Model Integrations

- **[Qwen2-VL Integration Guide](./QWEN2VL_INTEGRATION.md)** - Complete documentation for multimodal video analysis
- **[Qwen2-VL Quick Start](./QWEN2VL_QUICKSTART.md)** - 2-minute setup guide
- **[Qwen2-VL Usage Examples](./examples/qwen2vl-usage.js)** - Code examples
- **[AI Model Providers Comparison](../AI_MODEL_PROVIDERS.md)** - All available models

### Testing

Run the Qwen2-VL test suite:
```bash
node test-qwen2vl.js
```

## �🔒 Security Notes

- API keys from frontend are prioritized over environment variable
- Database uses SSL connections
- CORS is enabled for all origins (configure for production)
- Row-level security policies should be enabled in PostgreSQL

## 🐛 Troubleshooting

### Common Issues

1. **Database connection fails**
   - Check PostgreSQL credentials
   - Verify SSL settings
   - Ensure database server allows connections

2. **Gemini API errors**
   - Verify API key is valid
   - Check quota limits
   - Ensure video URL is accessible

3. **Port already in use**
   - Change PORT in .env file
   - Kill existing process: `lsof -ti:3001 | xargs kill`

## 📝 API Response Codes

- `200` - Success
- `400` - Bad request (missing parameters)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (quota exceeded)
- `429` - Too many requests
- `500` - Server error
- `503` - Service unavailable

## 🤝 Support

For issues or questions, contact the Navgurukul team.
