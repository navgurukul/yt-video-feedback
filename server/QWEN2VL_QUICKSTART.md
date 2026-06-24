# Qwen2-VL-7B-Instruct Integration - Quick Start

## 🚀 Installation (2 minutes)

```bash
# 1. Install dependencies
cd server
npm install @huggingface/inference

# 2. Configure API token
echo "HF_TOKEN=hf_your_token_here" >> .env

# 3. Start server
npm start

# 4. Test integration (in new terminal)
node test-qwen2vl.js
```

## 📝 Basic Usage

```javascript
// POST http://localhost:3001/analyze-video
const response = await fetch('http://localhost:3001/analyze-video', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    frames: [
      'https://example.com/frame1.jpg',
      'https://example.com/frame2.jpg'
    ],
    transcript: 'Your video transcript text here...'
  })
});

const result = await response.json();
console.log('Quality Score:', result.parsed.content_quality_score);
```

## 📚 Documentation

- **Complete Guide**: [QWEN2VL_INTEGRATION.md](./QWEN2VL_INTEGRATION.md)
- **Code Examples**: [examples/qwen2vl-usage.js](./examples/qwen2vl-usage.js)
- **Test Suite**: Run `node test-qwen2vl.js`

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| "HF_TOKEN required" | Add `HF_TOKEN=hf_...` to `.env` |
| "Request timeout" | Reduce frames or increase timeout |
| "No valid JSON" | Check server logs for raw response |
| Rate limit errors | Upgrade HF account or add throttling |

## 🎯 Key Features

- ✅ **Multimodal**: Analyzes images + text together
- ✅ **Production-Ready**: Error handling, retries, timeouts
- ✅ **Flexible**: Custom prompts and evaluation criteria
- ✅ **Scalable**: Works with URLs and base64 images

## 📊 Example Response

```json
{
  "success": true,
  "parsed": {
    "summary": "Clear introduction to HTML semantic elements...",
    "key_learning_points": [
      "Understanding semantic HTML structure",
      "Benefits for accessibility and SEO",
      "Practical implementation examples"
    ],
    "content_quality_score": 8,
    "suggestions_for_improvement": [
      "Add interactive exercises",
      "Include common mistakes section"
    ]
  }
}
```

## 🔗 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/analyze-video` | POST | Main video analysis |
| `/qwen2vl-health` | GET | Service health check |

## 🎓 Next Steps

1. Read [QWEN2VL_INTEGRATION.md](./QWEN2VL_INTEGRATION.md) for detailed docs
2. Try examples in [examples/qwen2vl-usage.js](./examples/qwen2vl-usage.js)
3. Run test suite: `node test-qwen2vl.js`
4. Integrate with your application

---

**Need help?** Check [Troubleshooting](#troubleshooting) or open an issue.
