# Example Usage: Switching Between Gemini and Hugging Face

## Setup Your Environment

### Option 1: Use Both Providers
```env
# .env file
GEMINI_API_KEY=AIzaSyC...
VITE_GEMINI_API_KEY=AIzaSyC...

HUGGINGFACE_API_KEY=hf_Abcd...
VITE_HUGGINGFACE_API_KEY=hf_Abcd...
```

### Option 2: Use Only One Provider
```env
# For Gemini only
GEMINI_API_KEY=AIzaSyC...
VITE_GEMINI_API_KEY=AIzaSyC...

# Or for Hugging Face only
HUGGINGFACE_API_KEY=hf_Abcd...
VITE_HUGGINGFACE_API_KEY=hf_Abcd...
```

## Using the Application

### Step 1: Select AI Model Provider
When you open the Video Analyzer page, you'll see:

```
┌─────────────────────────────────────────┐
│  ⚡ AI MODEL PROVIDER                   │
│                                         │
│  [Gemini API] [Hugging Face (Gemma)]  │
└─────────────────────────────────────────┘
```

Click your preferred provider.

### Step 2: Complete Your Evaluation
1. Select Video Type (Concept/Project/Other)
2. Select Phase (if applicable)
3. Enter YouTube URL
4. Click "🎯 ANALYZE VIDEO"

### Step 3: View Results
Results are displayed the same way regardless of which provider you used.

## API Request Examples

### Gemini API Request
```json
{
  "videoUrl": "https://youtube.com/watch?v=...",
  "videoDetails": "Video Title: HTML Basics...",
  "promptbegining": "Evaluate this video...",
  "structuredreturnedconfig": { ... },
  "evaluationType": "accuracy",
  "apiKey": "AIzaSyC...",
  "modelProvider": "gemini"
}
```

### Hugging Face Request
```json
{
  "videoUrl": "https://youtube.com/watch?v=...",
  "videoDetails": "Video Title: HTML Basics...",
  "promptbegining": "Evaluate this video...",
  "structuredreturnedconfig": { ... },
  "evaluationType": "accuracy",
  "apiKey": "hf_Abcd...",
  "modelProvider": "huggingface"
}
```

## Response Format (Both Providers)

Both providers return the same structure:
```json
{
  "raw": "full response text",
  "text": "full response text",
  "parsed": {
    // Structured evaluation data
    "Accuracy Level": [...],
    "Feedback": {...}
  }
}
```

## Expected Behavior Differences

### Gemini API (Default)
```
⏱️ Response Time: 5-15 seconds
📊 Video Analysis: Direct frame analysis
✨ Quality: High accuracy with visual details
💰 Cost: Per API call (free tier available)
```

### Hugging Face Gemma
```
⏱️ Response Time: 20-60 seconds (first call), 5-15 seconds (subsequent)
📊 Video Analysis: Text-based (URL context only)
✨ Quality: Good for text evaluation, limited visual analysis
💰 Cost: Free tier available, subject to rate limits
```

## Switching Between Providers

You can switch providers at any time:
1. No restart required
2. Previous evaluations are not affected
3. Each evaluation is independent

## Use Cases

### When to Use Gemini API
- ✅ Evaluating video demonstrations
- ✅ Analyzing visual code examples
- ✅ Assessing presentation quality
- ✅ When you need detailed video analysis

### When to Use Hugging Face
- ✅ Testing without Gemini API key
- ✅ When Gemini quota is exceeded
- ✅ Cost optimization scenarios
- ✅ Open-source preference
- ⚠️ Note: Limited visual analysis

## Error Messages You Might See

### Gemini Errors
```
❌ Invalid API key. Please check your Gemini API key in settings.
❌ API quota exceeded. Please try again later.
❌ Unable to connect to AI service.
```

### Hugging Face Errors
```
❌ Invalid Hugging Face API key
❌ Hugging Face API quota exceeded
❌ Hugging Face model is loading. Please try again in a few moments.
```

## Pro Tips

1. **First Time Setup**: Try Hugging Face first - it may take 30-60 seconds to load the model
2. **Production Use**: Use Gemini for better video analysis quality
3. **Development/Testing**: Hugging Face works great for text-based evaluations
4. **Fallback Strategy**: Set up both keys, switch if one fails

## Troubleshooting

### "Model is loading" message
**Wait 30 seconds and try again** - this is normal for first Hugging Face request

### Results seem less accurate with Hugging Face
**This is expected** - Hugging Face receives only the URL, not video frames. Use Gemini for better results.

### Want to permanently switch providers
**Just select your preferred provider** - the selection persists during your session
