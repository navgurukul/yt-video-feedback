# AI Model Provider Integration Guide

## Overview
You can now choose between **three AI model providers** for video evaluation:
1. **Gemini Flash 2.5** (Google) - Native video support ⭐ **Recommended**
2. **Qwen2-VL** (Alibaba/Hugging Face) - Open-source video analysis 🎥
3. **Gemma** (Hugging Face) - Text-only fallback option

## Model Comparison

| Feature | Gemini Flash 2.5 | Qwen2-VL | Gemma |
|---------|-----------------|----------|-------|
| **Video Analysis** | ✅ Native | ✅ Direct | ❌ Text-only |
| **Response Speed** | ⚡ Fast (2-5s) | ⏱️ Medium (10-30s) | ⚡ Fast (5-10s) |
| **Structured Output** | ✅ Excellent | ⚠️ Good | ⚠️ Requires cleanup |
| **Cost** | 💰 Paid API | 🆓 Free (HF) | 🆓 Free (HF) |
| **Cold Start** | None | 1-2 minutes | 20-60 seconds |
| **Best For** | Production | Open-source alternative | Text-only fallback |

## Setup

### 1. Get API Keys

#### For Gemini (Recommended):
1. Visit https://aistudio.google.com/apikey
2. Create new API key
3. Copy the key (format: `AIza...`)

#### For Qwen2-VL or Gemma (Hugging Face):
1. Visit https://huggingface.co/settings/tokens
2. Create a new access token (Read access is sufficient)
3. Copy the token (format: `hf_...`)

### 2. Configure Environment Variables
Add to your `.env` file (root directory):

```env
# Gemini API
GEMINI_API_KEY=AIza_your_key_here
VITE_GEMINI_API_KEY=AIza_your_key_here

# Hugging Face API (for both Qwen2-VL and Gemma)
HUGGINGFACE_API_KEY=hf_your_token_here
VITE_HUGGINGFACE_API_KEY=hf_your_token_here
```

### 3. Using the Feature
1. Open the Video Analyzer page
2. Select **AI Model Provider** at the top:
   - **🚀 Gemini Flash 2.5** - Best quality, native video analysis
   - **🎥 Qwen2-VL** - Open-source video analysis
   - **🤗 Gemma** - Text-only fallback
3. Continue with your normal evaluation workflow

## Detailed Model Information

### Gemini Flash 2.5 (Recommended)
✅ Native video analysis support  
✅ Fastest response times  
✅ Best structured output quality  
✅ Direct YouTube URL processing  
✅ Enforced JSON schema validation  
✅ No cold start delays  

**Use When:** Production environments, highest quality needed, budget available

### Qwen2-VL (Open-Source Video Analysis)
✅ Real video analysis capabilities  
✅ Open-source and free (via Hugging Face)  
✅ Direct video input support  
✅ Good for research and experimentation  
⚠️ Model loading time on first use (1-2 minutes)  
⚠️ JSON output may need cleanup  
⚠️ Slower than Gemini  

**Use When:** Need video analysis without API costs, open-source requirement, Gemini quota exceeded

**Model:** `Qwen/Qwen2-VL-72B-Instruct`

### Gemma (Text-Only Fallback)
✅ Fast response for text-only tasks  
✅ Alternative when Gemini quota exceeded  
✅ Free via Hugging Face  
❌ **No video processing** - URL context only  
⚠️ Model loading time on first use (20-60 seconds)  
⚠️ Lower quality evaluations  

**Use When:** Testing, text-only analysis, video analysis not required

**Model:** `google/gemma-3-27b-it`

## Implementation Details

### Backend Changes
- **Three evaluation functions:**
  - `evaluateWithGemini()` - Native Gemini SDK with video support
  - `evaluateWithQwen()` - Qwen2-VL via Hugging Face with video input
  - `evaluateWithHuggingFace()` - Gemma text-only via Hugging Face
- **Automatic routing** based on `modelProvider` parameter
- **Enhanced JSON extraction** for Qwen2-VL responses
- **Consistent error handling** across all providers

### Frontend Changes
- **Three-button model provider selection UI**
- **Visual indicators** for each model's capabilities
- **`modelProvider` field** passed to all evaluation API calls
- **Backward compatible:** Existing code defaults to Gemini

## Limitations

### Qwen2-VL Limitations
1. **Cold Start Delay**: First request may take 1-2 minutes as the large model loads
2. **Response Format**: May include markdown code blocks or extra text (handled by enhanced extraction)
3. **Rate Limits**: Subject to Hugging Face Inference API rate limits
4. **Slower**: 10-30 seconds per evaluation vs 2-5s for Gemini

### Gemma Limitations
1. **No Direct Video Analysis**: The model receives only the YouTube URL as text context, **cannot watch video**
2. **Cold Start Delay**: First request may take 20-60 seconds as the model loads
3. **Lower Quality**: Text-only approach misses visual content nuances
4. **JSON Quality**: May require additional parsing/extraction

## Troubleshooting

### Error: "Qwen2-VL model is loading"
**Solution**: Wait 1-2 minutes and try again. Large models (72B parameters) take longer to initialize on first use.

### Error: "Hugging Face model is loading"
**Solution**: Wait 30-60 seconds and try again. The model needs to warm up on first use.

### Error: "Invalid Hugging Face API key"
**Solution**: Verify your token is correct and has at least Read access at https://huggingface.co/settings/tokens

### Poor Evaluation Quality with Qwen2-VL
**Solution**: 
- Ensure video URL is accessible
- Try again after cold start completes
- Consider using Gemini for critical evaluations

### Poor Evaluation Quality with Gemma
**Solution**: Switch to Gemini or Qwen2-VL for video analysis. Gemma is text-only and cannot process video content.

### JSON Parsing Errors
**Solution**: The app automatically attempts multiple extraction methods:
1. Direct JSON parse
2. Remove markdown code blocks and retry
3. Regex extraction of first JSON object
4. Fallback error object with raw response

If issues persist, check backend logs for raw response debugging.

## When to Use Each Model

### Use Gemini Flash 2.5 When:
- ✅ Production environment
- ✅ Best quality evaluations needed
- ✅ Fast response time required
- ✅ Budget available for API costs
- ✅ Reliable structured output needed

### Use Qwen2-VL When:
- ✅ Open-source requirement
- ✅ Video analysis needed without API costs
- ✅ Experimentation and research
- ✅ Gemini quota exceeded
- ⚠️ Can tolerate slower response (10-30s)
- ⚠️ Can tolerate cold start delays (1-2 min initially)

### Use Gemma When:
- ✅ Text-only analysis acceptable
- ✅ Testing and development
- ✅ Budget constraints
- ❌ Video content analysis NOT required
- ❌ Lower quality evaluations acceptable

## Technical Notes
- **Backward compatible**: Existing evaluations default to Gemini
- **Single Hugging Face key**: Works for both Qwen2-VL and Gemma
- **Consistent response format**: All providers return `{ raw, text, parsed }` structure
- **Enhanced JSON extraction**: Handles markdown wrappers, nested braces, incomplete responses
- **Error handling**: Maintains same patterns across all providers

## API Endpoints

### Gemini
- **Endpoint**: Google GenAI SDK streaming
- **Model**: `gemini-2.5-flash`
- **Video Input**: Native via `fileData.fileUri`

### Qwen2-VL
- **Endpoint**: `https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-72B-Instruct`
- **Model**: `Qwen/Qwen2-VL-72B-Instruct`
- **Video Input**: Direct via `inputs.video`

### Gemma
- **Endpoint**: `https://router.huggingface.co/v1/chat/completions`
- **Model**: `google/gemma-3-27b-it`
- **Video Input**: Text-only (YouTube URL as context)
