# Hugging Face Gemma Model Integration

## Overview
You can now choose between two AI model providers for video evaluation:
1. **Gemini API** (default) - Google's Gemini 2.5 Flash with native video support
2. **Hugging Face Gemma** - Google's Gemma 2 9B model via Hugging Face Inference API

## Setup

### 1. Get a Hugging Face API Key
1. Visit https://huggingface.co/settings/tokens
2. Create a new access token (Read access is sufficient)
3. Copy the token (format: `hf_...`)

### 2. Configure Environment Variables
Add to your `.env` file (root directory) or `server/.env`:

```env
HUGGINGFACE_API_KEY=hf_your_token_here
VITE_HUGGINGFACE_API_KEY=hf_your_token_here
```

### 3. Using the Feature
1. Open the Video Analyzer page
2. Select **AI Model Provider** at the top:
   - **Gemini API** - Uses Google Gemini (supports direct video analysis)
   - **Hugging Face (Gemma)** - Uses Gemma model via Hugging Face
3. Continue with your normal evaluation workflow

## Key Differences

### Gemini API (Recommended)
✅ Native video analysis support  
✅ Faster response times  
✅ Better structured output  
✅ Direct YouTube URL processing  

### Hugging Face Gemma
✅ Open-source model  
✅ Alternative when Gemini quota exceeded  
✅ Text-based analysis approach  
⚠️ Model loading time on first use (may take 20-60 seconds)  
⚠️ Text-only analysis (no direct video processing)  

## Implementation Details

### Backend Changes
- New `evaluateWithHuggingFace()` function in `server/index.js`
- Automatic routing based on `modelProvider` parameter
- Uses Hugging Face Inference API endpoint: `https://api-inference.huggingface.co/models/google/gemma-2-9b-it`

### Frontend Changes
- Model provider selection UI in `VideoAnalyzer.tsx`
- `modelProvider` field passed to all evaluation API calls
- No changes to existing Gemini functionality

## Limitations

### Hugging Face Gemma Limitations
1. **No Direct Video Analysis**: The model receives only the YouTube URL as text context, not the actual video frames
2. **Cold Start Delay**: First request may take 20-60 seconds as the model loads
3. **Response Format**: May require additional JSON parsing/extraction
4. **Rate Limits**: Subject to Hugging Face Inference API rate limits

## Troubleshooting

### Error: "Hugging Face model is loading"
**Solution**: Wait 30-60 seconds and try again. The model needs to warm up on first use.

### Error: "Invalid Hugging Face API key"
**Solution**: Verify your token is correct and has at least Read access.

### Poor Evaluation Quality
**Solution**: Use Gemini API for better results. Hugging Face approach is text-only and may not capture video nuances.

## Future Improvements
- [ ] Add video-to-text extraction before Hugging Face analysis
- [ ] Support other Hugging Face models
- [ ] Cache model loading state
- [ ] Add retry logic for cold starts
- [ ] Implement streaming responses

## Technical Notes
- Backward compatible: Existing evaluations default to Gemini
- Environment variables follow same pattern as Gemini keys
- Both APIs return consistent JSON structure
- Error handling maintains same patterns across providers
