# Variance Test Guide

## Overview

The Variance Test feature helps you identify and eliminate inconsistencies in Gemini API evaluations by running the same video through multiple iterations and analyzing the differences.

## What Was Changed

### 1. Deterministic Parameters Added ✅

All four generation configs now include parameters to eliminate non-determinism:

**File:** `src/data/prompt.ts`

```typescript
export const AccuracyConfig = {
  thinkingConfig: { thinkingBudget: -1 },
  temperature: 0,        // Deterministic sampling
  topK: 1,              // Always pick most likely token
  topP: 1.0,            // NEW: No nucleus sampling
  candidateCount: 1,    // NEW: Force single response variant
  seed: 42,             // Fixed random seed
  responseMimeType: 'application/json',
  responseSchema: { /* ... */ }
}
```

**Applied to:**
- `AccuracyConfig` (concept explanation accuracy)
- `AbilityToExplainConfig` (ability to explain)
- `projectconfig` (project evaluations)
- `CustomConfig` (custom evaluations)

### 2. New Test Endpoint 🧪

**Endpoint:** `POST /test-variance`

**Location:** `server/index.js`

**Capabilities:**
- Runs identical video evaluations multiple times (2-10 iterations)
- Compares all responses using deep comparison
- Calculates consistency score (0-100%)
- Identifies differing fields
- Generates actionable recommendations
- Uses Levenshtein distance for text similarity (95% threshold)

### 3. Frontend Test Page 🎨

**Route:** `/variance-test`

**Location:** `src/pages/VarianceTest.tsx`

**Features:**
- Interactive configuration panel
- Real-time test execution
- Visual consistency scoring (color-coded)
- Detailed variance analysis
- Individual response inspection
- Recommendations display
- Usage guide built-in

## How to Use

### Step 1: Start the Application

```bash
# Terminal 1: Backend API
cd server
npm install
npm start

# Terminal 2: Frontend dev server
cd ..
npm install
npm run dev
```

### Step 2: Access the Test Page

Navigate to: `http://localhost:3000/variance-test`

### Step 3: Configure Your Test

1. **Video URL**: Enter a YouTube video URL you want to test
2. **Evaluation Type**: Choose accuracy, ability, or project
3. **Iterations**: Set number of test runs (recommended: 3-5)
4. **Video Details**: Describe expected content/topics
5. **API Key** (optional): Use custom API key or server default

### Step 4: Run the Test

Click "Run Variance Test" button. The test will:
- Execute N identical evaluations sequentially
- Show progress for each iteration
- Display timing information
- Calculate variance metrics

### Step 5: Analyze Results

**Consistency Score Interpretation:**
- ✅ **95-100%**: Excellent - fully deterministic
- ⚠️ **80-94%**: Good - minor variance present
- ❌ **<80%**: Poor - high variance, action needed

**Key Metrics:**
- **Identical Count**: How many responses matched exactly
- **Variance %**: Percentage of differing responses
- **Differing Fields**: Which JSON fields varied
- **Avg Time**: Average evaluation duration

### Step 6: Review Recommendations

The system automatically generates recommendations based on:
- Consistency score level
- Types of fields that differ
- Evaluation type being tested

Common recommendations:
- Strengthen prompt determinism with checklists
- Switch from streaming to non-streaming API
- Implement response caching
- Adjust prompt templates

## API Usage (Programmatic Testing)

```bash
curl -X POST http://localhost:3001/test-variance \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=...",
    "evaluationType": "accuracy",
    "videoDetails": "HTML basics: tags, attributes, elements",
    "promptbegining": "...",
    "structuredreturnedconfig": {...},
    "iterations": 3
  }'
```

**Response Example:**

```json
{
  "success": true,
  "iterations": 3,
  "successful_count": 3,
  "total_time_ms": 15234,
  "avg_iteration_time_ms": 5078,
  "variance_analysis": {
    "identical_count": 2,
    "total_comparisons": 2,
    "variance_percentage": 0,
    "consistency_score": 100,
    "differing_fields": []
  },
  "recommendations": [
    "✅ Excellent consistency! Current configuration is working well.",
    "Consider implementing response caching for 100% consistency."
  ]
}
```

## Troubleshooting

### High Variance (< 80% consistency)

**Possible Causes:**
1. **Prompt ambiguity**: Vague instructions allow interpretation variance
2. **Missing thresholds**: No exact percentage cutoffs for levels
3. **Feedback text**: Natural language feedback varies even with same score
4. **API streaming**: Streaming responses may introduce timing variance

**Solutions:**
1. Add explicit checklists to prompts (✓/✗ format)
2. Replace ranges like "40-60%" with "count X criteria, assign level if >= Y"
3. Use structured feedback templates
4. Test with non-streaming `generateContent()` instead of `generateContentStream()`

### Feedback Text Variance

If only feedback text differs but scores are identical:

1. This is **acceptable variance** (semantically equivalent)
2. The scoring is deterministic, which is the goal
3. Consider using fixed templates if identical text is critical

### API Errors

If iterations fail with API errors:

- **401/403**: Check API key validity
- **429**: Rate limit exceeded, wait before retrying
- **500/503**: Gemini API issues, try again later
- **Timeout**: Increase server timeout or reduce video length

## Best Practices

### Testing Strategy

1. **Start small**: Run 3-4 iterations first to gauge consistency
2. **Test different types**: Accuracy, ability, and project evaluations separately
3. **Use clear videos**: Unambiguous content reduces variance
4. **Test edge cases**: Off-topic videos, ambiguous content, perfect videos

### Recommended Test Videos

- ✅ Perfect explanation video (should get 90-100% score)
- ⚠️ Partial explanation video (should get 50-70% score)
- ❌ Off-topic video (should get 0-20% score)
- 🤔 Ambiguous content video (tests boundary cases)

### When to Use Each Evaluation Type

**Accuracy Test:**
- Concept explanation videos
- Factual correctness focus
- Binary/percentage scoring

**Ability Test:**
- Communication quality assessment
- Feynman technique evaluation
- Level-based scoring (Beginner → Expert)

**Project Test:**
- Project walkthrough videos
- Multi-parameter rubric evaluation
- Weighted scoring

## Implementation Caching (Optional Next Step)

To achieve 100% consistency, implement response caching:

```sql
CREATE TABLE tbl_evaluation_cache (
  id SERIAL PRIMARY KEY,
  input_hash VARCHAR(64) UNIQUE NOT NULL,
  evaluation_type VARCHAR(20) NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP DEFAULT NOW(),
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX idx_evaluation_cache_hash ON tbl_evaluation_cache(input_hash);
```

**Cache Key Generation:**

```javascript
const crypto = require('crypto');

function generateCacheKey(videoUrl, evaluationType, videoDetails, config) {
  const input = JSON.stringify({
    videoUrl,
    evaluationType,
    videoDetails,
    config: {
      temperature: config.temperature,
      topK: config.topK,
      topP: config.topP,
      seed: config.seed
    }
  });
  
  return crypto.createHash('sha256').update(input).digest('hex');
}
```

## Configuration Reference

### Current Deterministic Settings

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `temperature` | 0 | Eliminates randomness in token selection |
| `topK` | 1 | Always picks most likely token |
| `topP` | 1.0 | Disables nucleus sampling |
| `candidateCount` | 1 | Forces single response variant |
| `seed` | 42 | Fixed random seed for reproducibility |
| `thinkingBudget` | -1 | Unlimited thinking tokens |

### Why These Values?

- **temperature: 0** → Greedy decoding (deterministic)
- **topK: 1** → No token sampling, always pick best
- **topP: 1.0** → No probability mass cutoff
- **candidateCount: 1** → No internal response variants
- **seed: 42** → Reproducible pseudo-randomness

## Support & Feedback

If you encounter issues or have suggestions:

1. Check console logs in browser DevTools and server terminal
2. Review the detailed variance analysis output
3. Try different evaluation types and video content
4. Experiment with prompt modifications

## Summary

✅ **What Was Added:**
- `topP: 1.0` and `candidateCount: 1` parameters
- `/test-variance` API endpoint with deep comparison
- Frontend variance test page with visualizations
- Comprehensive analysis and recommendations

🎯 **Expected Outcome:**
- 95%+ consistency score for most evaluations
- Identical scores across iterations
- Minor variance in feedback text (acceptable)
- Clear identification of any remaining variance sources

📊 **Next Steps:**
1. Run variance tests on your actual videos
2. Review recommendations for any variance found
3. Implement caching if 100% consistency is required
4. Monitor production evaluations for drift
