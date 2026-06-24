# Qwen2-VL-7B-Instruct Integration Guide

## Overview

This document provides complete instructions for integrating and using the **Qwen2-VL-7B-Instruct** multimodal vision-language model for video content analysis.

The Qwen2-VL model can analyze both visual content (video frames) and textual content (transcripts) to provide comprehensive educational video evaluations.

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [API Usage](#api-usage)
6. [Request Examples](#request-examples)
7. [Response Format](#response-format)
8. [Error Handling](#error-handling)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Features

✅ **Multimodal Analysis**: Processes both video frames (images) and transcript text  
✅ **Structured JSON Output**: Returns consistent, parseable evaluation results  
✅ **Production-Ready**: Includes timeout handling, retry logic, and comprehensive error handling  
✅ **Flexible Input**: Supports image URLs and base64-encoded images  
✅ **Custom Prompts**: Allow custom evaluation criteria  
✅ **Health Check Endpoint**: Monitor service availability  
✅ **Detailed Logging**: Track analysis progress and debug issues  

---

## Prerequisites

1. **Node.js**: Version 18.x or higher
2. **Hugging Face Account**: Free account at [huggingface.co](https://huggingface.co)
3. **Hugging Face API Token**: Generate at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
4. **npm packages**: See [Installation](#installation)

---

## Installation

### 1. Install Dependencies

Navigate to your server directory and install required packages:

```bash
cd server
npm install @huggingface/inference dotenv express cors
```

### 2. Update package.json

Ensure your `package.json` includes:

```json
{
  "type": "module",
  "dependencies": {
    "@huggingface/inference": "^2.8.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
```

### 3. Verify Installation

```bash
npm list @huggingface/inference
```

Expected output: `@huggingface/inference@2.8.0` (or higher)

---

## Configuration

### 1. Environment Variables

Create or update your `.env` file in the server directory:

```bash
# Hugging Face API Token (REQUIRED)
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Alternative variable name (fallback)
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Server Configuration
PORT=3001
```

### 2. Get Your Hugging Face Token

1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Click **"New token"**
3. Choose **"Read"** access type
4. Copy the token (starts with `hf_`)
5. Add to your `.env` file

### 3. Verify Configuration

Test your configuration:

```bash
curl http://localhost:3001/qwen2vl-health
```

Expected response:
```json
{
  "status": "healthy",
  "model": "Qwen/Qwen2-VL-7B-Instruct",
  "token_configured": true,
  "timestamp": "2026-02-16T..."
}
```

---

## API Usage

### Endpoint: `POST /analyze-video`

Analyzes video content using frames and transcript.

**URL**: `http://localhost:3001/analyze-video`

**Method**: `POST`

**Content-Type**: `application/json`

### Request Body Schema

```typescript
{
  frames: string[];          // REQUIRED: Array of image URLs or base64 data URIs
  transcript: string;        // REQUIRED: Video transcript text
  customPrompt?: string;     // OPTIONAL: Custom evaluation prompt
  timeout?: number;          // OPTIONAL: Request timeout in ms (default: 60000)
  maxRetries?: number;       // OPTIONAL: Max retry attempts (default: 2)
}
```

### Response Schema

```typescript
{
  success: boolean;
  raw: string;                    // Full model response text
  parsed: {
    summary: string;
    key_learning_points: string[];
    content_quality_score: number;  // 1-10 scale
    quality_analysis: {
      visual_clarity: string;
      explanation_quality: string;
      pacing: string;
      engagement: string;
    };
    suggestions_for_improvement: string[];
    target_audience: string;
    estimated_comprehension_level: string;
  };
  metadata: {
    model: string;
    frames_analyzed: number;
    transcript_length: number;
    attempt: number;
    timestamp: string;
  };
}
```

---

## Request Examples

### Example 1: Basic Analysis with Image URLs

```javascript
const response = await fetch('http://localhost:3001/analyze-video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    frames: [
      'https://example.com/video-frame-1.jpg',
      'https://example.com/video-frame-2.jpg',
      'https://example.com/video-frame-3.jpg'
    ],
    transcript: `Welcome to this HTML tutorial. Today we'll learn about semantic HTML elements.
    
    Semantic HTML elements clearly describe their meaning in both human and machine-readable ways.
    
    For example, <header>, <nav>, <main>, and <footer> are semantic elements that describe
    the structure of a web page...`
  })
});

const result = await response.json();
console.log('Quality Score:', result.parsed.content_quality_score);
console.log('Summary:', result.parsed.summary);
```

### Example 2: Analysis with Base64 Images

```javascript
// Convert image to base64
const imageToBase64 = async (imageUrl) => {
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
};

const frames = await Promise.all([
  imageToBase64('https://example.com/frame1.jpg'),
  imageToBase64('https://example.com/frame2.jpg')
]);

const response = await fetch('http://localhost:3001/analyze-video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    frames,
    transcript: 'Your video transcript here...'
  })
});
```

### Example 3: Custom Evaluation Prompt

```javascript
const customPrompt = `Evaluate this web development tutorial video.

Focus on:
1. Code quality and best practices
2. Visual demonstration effectiveness
3. Pacing for beginners
4. Common mistakes addressed

Provide response in JSON format with:
- summary (string)
- key_learning_points (array)
- content_quality_score (1-10)
- code_quality_assessment (string)
- beginner_friendliness_score (1-10)
- suggestions_for_improvement (array)`;

const response = await fetch('http://localhost:3001/analyze-video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    frames: ['https://...', 'https://...'],
    transcript: 'Video transcript...',
    customPrompt: customPrompt
  })
});
```

### Example 4: With Custom Timeout and Retries

```javascript
const response = await fetch('http://localhost:3001/analyze-video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    frames: ['https://...'],
    transcript: 'Video transcript...',
    timeout: 90000,     // 90 seconds
    maxRetries: 3       // Try up to 3 times
  })
});
```

### Example 5: Using cURL

```bash
curl -X POST http://localhost:3001/analyze-video \
  -H "Content-Type: application/json" \
  -d '{
    "frames": [
      "https://example.com/frame1.jpg",
      "https://example.com/frame2.jpg"
    ],
    "transcript": "Welcome to this tutorial on HTML basics. Today we will learn about semantic elements and their importance in web development...",
    "timeout": 60000,
    "maxRetries": 2
  }'
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "raw": "Full text response from model...",
  "parsed": {
    "summary": "This tutorial introduces HTML semantic elements with clear visual examples and practical demonstrations.",
    "key_learning_points": [
      "Understanding semantic HTML elements (<header>, <nav>, <main>, <footer>)",
      "Benefits of semantic markup for accessibility and SEO",
      "Practical implementation examples with code snippets"
    ],
    "content_quality_score": 8,
    "quality_analysis": {
      "visual_clarity": "Excellent - Code examples are well-formatted and easy to read",
      "explanation_quality": "Good - Clear explanations with practical context",
      "pacing": "Appropriate for beginners - Not too fast, allows time to understand",
      "engagement": "Strong - Uses real-world examples and relatable scenarios"
    },
    "suggestions_for_improvement": [
      "Add more interactive exercises for viewers to practice",
      "Include common mistakes and how to avoid them",
      "Provide additional resources for further learning"
    ],
    "target_audience": "Beginner web developers learning HTML fundamentals",
    "estimated_comprehension_level": "Beginner"
  },
  "metadata": {
    "model": "Qwen/Qwen2-VL-7B-Instruct",
    "frames_analyzed": 3,
    "transcript_length": 847,
    "attempt": 1,
    "timestamp": "2026-02-16T10:30:45.123Z"
  }
}
```

### Error Response Examples

#### Missing Required Fields (400 Bad Request)

```json
{
  "error": "Missing or invalid frames array",
  "details": "Request must include \"frames\" array with at least one image URL or base64 string"
}
```

#### Configuration Error (500 Internal Server Error)

```json
{
  "error": "Configuration error",
  "details": "Hugging Face API token not configured. Set HF_TOKEN environment variable.",
  "message": "HF_TOKEN environment variable is required for Qwen2-VL analysis"
}
```

#### Timeout Error (504 Gateway Timeout)

```json
{
  "error": "Request timeout",
  "details": "Analysis took too long to complete. Try reducing frame count or extending timeout.",
  "message": "Request timeout exceeded"
}
```

#### Service Unavailable (502 Bad Gateway)

```json
{
  "error": "Service temporarily unavailable",
  "details": "Analysis failed after multiple retry attempts. Please try again later.",
  "message": "Qwen2-VL analysis failed after 2 attempts: ..."
}
```

---

## Error Handling

### Best Practices

```javascript
async function analyzeVideoSafely(frames, transcript) {
  try {
    const response = await fetch('http://localhost:3001/analyze-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frames, transcript })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error (${response.status}): ${error.error} - ${error.details}`);
    }

    const result = await response.json();
    
    // Validate response structure
    if (!result.success || !result.parsed) {
      throw new Error('Invalid response structure from API');
    }

    return result;
    
  } catch (error) {
    console.error('Video analysis failed:', error);
    
    // Handle specific error types
    if (error.message.includes('timeout')) {
      console.error('Recommendation: Reduce frame count or increase timeout');
    } else if (error.message.includes('token')) {
      console.error('Recommendation: Check HF_TOKEN environment variable');
    }
    
    throw error;
  }
}
```

### Error Categories

| Error Type | Status Code | Common Causes | Solutions |
|------------|-------------|---------------|-----------|
| Validation Error | 400 | Missing/invalid input | Check request body format |
| Configuration Error | 500 | Missing HF_TOKEN | Set environment variable |
| Timeout Error | 504 | Large frames, slow network | Reduce frames, increase timeout |
| Service Error | 502 | API rate limits, model issues | Retry later, check status |

---

## Production Deployment

### 1. Environment Configuration

**Production `.env`:**

```bash
# Production Hugging Face Token
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Production Server
PORT=3001
NODE_ENV=production

# Logging
LOG_LEVEL=info
```

### 2. Performance Optimization

```javascript
// Recommended production settings
const productionConfig = {
  timeout: 90000,           // 90 seconds for large videos
  maxRetries: 3,           // More retries for reliability
  maxFrames: 10,           // Limit frame count to reduce costs
  frameInterval: 5         // Extract 1 frame every 5 seconds
};
```

### 3. Rate Limiting

Add rate limiting to protect your API:

```javascript
import rateLimit from 'express-rate-limit';

const videoAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 requests per window
  message: 'Too many analysis requests, please try again later'
});

app.post('/analyze-video', videoAnalysisLimiter, async (req, res) => {
  // ... handler code
});
```

### 4. Monitoring

```javascript
// Add request tracking
app.use((req, res, next) => {
  if (req.path === '/analyze-video') {
    console.log({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      frames: req.body?.frames?.length || 0,
      transcript_length: req.body?.transcript?.length || 0
    });
  }
  next();
});
```

### 5. Scaling Considerations

- **Horizontal Scaling**: Deploy multiple server instances behind load balancer
- **Caching**: Cache analysis results for identical frame+transcript combinations
- **Queue System**: Use job queue (Bull, BullMQ) for async processing
- **Cost Management**: Monitor Hugging Face API usage and set budgets

---

## Troubleshooting

### Issue: "HF_TOKEN environment variable is required"

**Solution:**
1. Verify `.env` file exists in server directory
2. Check token is correctly formatted: `HF_TOKEN=hf_...`
3. Restart server after changing `.env`
4. Test with: `echo $HF_TOKEN` (should show your token)

### Issue: "Request timeout exceeded"

**Solutions:**
1. Reduce number of frames (try 3-5 frames max)
2. Increase timeout: `{ timeout: 120000 }` (120 seconds)
3. Use smaller image sizes (compress or resize)
4. Check network connectivity to Hugging Face API

### Issue: "No valid JSON found in response"

**Solutions:**
1. Check model is returning structured output
2. Verify custom prompt includes JSON format instructions
3. Review server logs for raw response
4. Try using default prompt (omit `customPrompt`)

### Issue: Rate Limit Errors

**Solutions:**
1. Upgrade Hugging Face account (PRO plan for higher limits)
2. Implement request queuing/throttling
3. Cache results to reduce API calls
4. Space out analysis requests

### Issue: Invalid Frame Format

**Solutions:**
1. Verify URLs are accessible (test in browser)
2. Check base64 format: `data:image/jpeg;base64,...`
3. Ensure images are valid JPEG/PNG formats
4. Validate URLs before sending: `new URL(frame)`

### Debug Mode

Enable detailed logging:

```javascript
// In qwen2vl-service.js, set verbose logging
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('Request payload:', JSON.stringify(payload, null, 2));
  console.log('Raw response:', responseText);
}
```

Run with debug:
```bash
DEBUG=true npm start
```

---

## Health Check

### Endpoint: `GET /qwen2vl-health`

Monitor service status:

```bash
curl http://localhost:3001/qwen2vl-health
```

**Healthy Response:**
```json
{
  "status": "healthy",
  "model": "Qwen/Qwen2-VL-7B-Instruct",
  "token_configured": true,
  "timestamp": "2026-02-16T10:30:45.123Z"
}
```

**Unhealthy Response:**
```json
{
  "status": "unhealthy",
  "error": "Invalid authentication token",
  "token_configured": false,
  "timestamp": "2026-02-16T10:30:45.123Z"
}
```

---

## Additional Resources

- **Hugging Face Inference Documentation**: [huggingface.co/docs/api-inference](https://huggingface.co/docs/api-inference)
- **Qwen2-VL Model Card**: [huggingface.co/Qwen/Qwen2-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2-VL-7B-Instruct)
- **@huggingface/inference Package**: [npmjs.com/package/@huggingface/inference](https://www.npmjs.com/package/@huggingface/inference)
- **API Token Management**: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

---

## Support

For issues specific to:
- **Qwen2-VL Model**: [Hugging Face Community Forums](https://discuss.huggingface.co/)
- **Integration Code**: Check server logs and GitHub issues
- **API Limits**: [Hugging Face Pricing](https://huggingface.co/pricing)

---

**Last Updated**: February 16, 2026  
**Version**: 1.0.0  
**Minimum Node.js**: 18.x
