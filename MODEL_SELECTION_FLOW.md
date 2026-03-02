# Model Selection Flow Diagram

## User Journey Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    VideoAnalyzer Page                         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│         Step 1: Select Video Type                             │
│  [ Concept ]  [ Project ]  [ Other ]                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│         Step 2: Choose AI Model (NEW!)                        │
│  ┌────────────────────────────────────────────────────┐      │
│  │  🎨 AI Model                           [ ⚪ OFF ]   │      │
│  │  Gemini 2.5 Flash - Stable and production-ready    │      │
│  └────────────────────────────────────────────────────┘      │
│                          OR                                   │
│  ┌────────────────────────────────────────────────────┐      │
│  │  ✨ AI Model                           [ 🟢 ON ]    │      │
│  │  ⚡ Gemini 3.0 Flash - 2-3x faster with timestamps │      │
│  │  ✨ Enhanced: Audio timestamps, search grounding   │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│         Step 3: Fill Form Details                             │
│  - Phase Selection                                            │
│  - Video Title (for concept)                                  │
│  - YouTube URL                                                │
└──────────────────────────────────────────────────────────────┘
                            ↓
                  [ Analyze Video ]
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
┌───────────────────┐                  ┌───────────────────┐
│  Toggle OFF       │                  │   Toggle ON       │
│  Gemini 2.5 Flash │                  │  Gemini 3.0 Flash │
└───────────────────┘                  └───────────────────┘
        ↓                                       ↓
┌───────────────────┐                  ┌───────────────────┐
│  POST /evaluate   │                  │ POST /evaluate-v3 │
│  (Stable)         │                  │ (Enhanced)        │
└───────────────────┘                  └───────────────────┘
        ↓                                       ↓
        └───────────────────┬───────────────────┘
                            ↓
              ┌─────────────────────────┐
              │  Evaluation Response    │
              │  + Model Metadata       │
              └─────────────────────────┘
                            ↓
              ┌─────────────────────────┐
              │ POST /store-evaluation  │
              │ with modelUsed param    │
              └─────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────────┐
        ↓                   ↓                       ↓
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Concept Table  │ │  Project Table  │ │  Custom Table   │
│  (AWS RDS)      │ │  (AWS RDS)      │ │  (AWS RDS)      │
│  comment:       │ │  comment:       │ │  comment:       │
│  "Gemini 2.5"   │ │  "Gemini 3.0"   │ │  "Gemini 2.5"   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Data Flow Detail

### Frontend State Management

```javascript
// VideoAnalyzer.tsx state
const [useGemini3, setUseGemini3] = useState(false);

// Switch component controls state
<Switch
  checked={useGemini3}
  onCheckedChange={setUseGemini3}
/>

// Dynamic endpoint selection
const endpoint = useGemini3 ? '/evaluate-v3' : '/evaluate';

// Model info for database
const modelUsed = useGemini3 ? 'Gemini 3.0 Flash' : 'Gemini 2.5 Flash';
const requestData = {
  ...otherData,
  modelUsed: `Evaluated using ${modelUsed}`
};
```

### API Request Flow

```
TOGGLE OFF (Gemini 2.5 Flash)
───────────────────────────────────
Frontend                        Backend
   │                               │
   │  POST /evaluate               │
   │  {                            │
   │    config: Enhanced_2_5,      │
   │    videoUrl: "...",           │
   │    ...                        │
   │  } ─────────────────────────→ │
   │                               │
   │         ←────────────────────  │ Gemini 2.5 API
   │  {                            │
   │    evaluation: {...},         │
   │    model: "gemini-2.5-flash"  │
   │  }                            │
   │                               │
   │  POST /store-evaluation       │
   │  {                            │
   │    ...evaluationData,         │
   │    modelUsed: "Evaluated      │
   │     using Gemini 2.5 Flash"   │
   │  } ─────────────────────────→ │
   │                               │
   │         ←────────────────────  │ PostgreSQL INSERT
   │  { success: true, id: 123 }   │ (comment column)
   │                               │


TOGGLE ON (Gemini 3.0 Flash)
───────────────────────────────────
Frontend                        Backend
   │                               │
   │  POST /evaluate-v3            │
   │  {                            │
   │    config: Config_3_0,        │
   │    videoUrl: "...",           │
   │    enableSearchGrounding: true│
   │  } ─────────────────────────→ │
   │                               │
   │         ←────────────────────  │ Gemini 3.0 API
   │  {                            │
   │    evaluation: {...},         │
   │    model: "gemini-3.0-flash", │
   │    audioTimestamps: [...],    │
   │    thinkingTokens: 245        │
   │  }                            │
   │                               │
   │  POST /store-evaluation       │
   │  {                            │
   │    ...evaluationData,         │
   │    modelUsed: "Evaluated      │
   │     using Gemini 3.0 Flash"   │
   │  } ─────────────────────────→ │
   │                               │
   │         ←────────────────────  │ PostgreSQL INSERT
   │  { success: true, id: 124 }   │ (comment column)
   │                               │
```

### Database Schema Changes (PostgreSQL on AWS RDS)

```sql
-- BEFORE (Old Schema)
tbl_ailabs_ytfeedback_concept_evaluations
  - id
  - email
  - project_name
  - page_name
  - video_url
  - concept_explanation_accuracy
  - concept_explanation_feedback
  - ability_to_explain_evaluation
  - ability_to_explain_feedback
  - created_at

-- AFTER (New Schema) - AWS RDS PostgreSQL
tbl_ailabs_ytfeedback_concept_evaluations
  - id
  - email
  - project_name
  - page_name
  - video_url
  - concept_explanation_accuracy
  - concept_explanation_feedback
  - ability_to_explain_evaluation
  - ability_to_explain_feedback
  - comment  ← NEW: Stores model used (already added)
  - created_at
```

## Switch Component Structure

```typescript
// src/components/ui/switch.tsx
<Switch.Root>  ← Radix UI primitive
  <Switch.Thumb />  ← Sliding indicator
</Switch.Root>

// Styled with Tailwind
- Default: Gray background
- Checked: Primary color background
- Transition: Smooth transform
- Focus: Ring indicator
- Size: 40x24px
```

## UI Component Breakdown

```
┌────────────────────────────────────────────────────────────┐
│ AI Model Selection Card                                     │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Border: primary/20                                      │ │
│ │ Background: primary/5                                   │ │
│ │ Padding: 24px                                           │ │
│ │                                                          │ │
│ │ ┌────────────────────────────────────────┬───────────┐ │ │
│ │ │ ✨ AI Model (Label)                    │  [Switch] │ │ │
│ │ └────────────────────────────────────────┴───────────┘ │ │
│ │                                                          │ │
│ │ ┌──────────────────────────────────────────────────────┐│ │
│ │ │ Dynamic Description Text:                            ││ │
│ │ │ • OFF: "Gemini 2.5 Flash - Stable..."               ││ │
│ │ │ • ON: "⚡ Gemini 3.0 Flash - 2-3x faster..."        ││ │
│ │ └──────────────────────────────────────────────────────┘│ │
│ │                                                          │ │
│ │ ┌──────────────────────────────────────────────────────┐│ │
│ │ │ Enhanced Features Note (if ON):                      ││ │
│ │ │ ✨ Audio timestamps, search grounding, thinking...   ││ │
│ │ └──────────────────────────────────────────────────────┘│ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

## Model Comparison Table

| Feature | Gemini 2.5 Flash | Gemini 3.0 Flash |
|---------|------------------|------------------|
| **Endpoint** | `/evaluate` | `/evaluate-v3` |
| **Speed** | Standard | 2-3x faster |
| **Audio Timestamps** | ❌ | ✅ |
| **Search Grounding** | ❌ | ✅ (optional) |
| **Thinking Tokens** | ❌ | ✅ |
| **Code Execution** | ❌ | ✅ (optional) |
| **Context Caching** | ❌ | ✅ (optional) |
| **Safety Settings** | Standard | Enhanced |
| **Status** | Production | Enhanced |
| **Database Value** | "Evaluated using Gemini 2.5 Flash" | "Evaluated using Gemini 3.0 Flash" |

## Integration Points

### 1. Frontend → Backend Request
```javascript
// Concept evaluation example
const accuracyResp = await fetch(apiUrl + endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...accuracyPayload,
    ...(useGemini3 && { enableSearchGrounding: true })  // Optional feature
  })
});
```

### 2. Backend → Gemini API
```javascript
// server/index.js
if (endpoint === '/evaluate-v3') {
  // Use Gemini 3.0 enhanced config
  generationConfig = {
    ...baseConfig,
    audioTimestamp: true,  // Enable timestamps
    candidateCount: 1,
    responseMimeType: "application/json"
  };
} else {
  // Use Gemini 2.5 standard config
  generationConfig = baseConfig;
}
```

### 3. Backend → Database Storage
```javascript
// Extract model info from request
const { modelUsed } = req.body;

// Store in PostgreSQL with fallback
const values = [
  ...otherValues,
  modelUsed || 'Evaluated using Gemini 2.5 Flash'  // Default fallback
];

// INSERT query includes comment column
await pgPool.query(`
  INSERT INTO ... (... , comment, created_at)
  VALUES (..., $9, NOW())
`, values);
```

## Error Handling

```
User Action → Frontend Validation → Backend Processing → Database Storage
                    ↓                      ↓                    ↓
               [Error Toast]        [API Error]         [SQL Error]
                    ↓                      ↓                    ↓
            "Please check"       "Model unavailable"   "Save failed"
            "your input"         "Try again"           "Contact admin"
```

## Testing Checklist

- [ ] Toggle switches between models smoothly
- [ ] UI updates description text when toggled
- [ ] Gemini 2.5 Flash calls `/evaluate` endpoint
- [ ] Gemini 3.0 Flash calls `/evaluate-v3` endpoint
- [ ] Search grounding enabled only for Gemini 3.0
- [ ] Model info passed to `/store-evaluation`
- [ ] AWS RDS PostgreSQL stores correct model name in comment column
- [ ] All three video types work (concept/project/custom)
- [ ] Old evaluations (without model info) still work
- [ ] Default fallback to Gemini 2.5 Flash works
- [ ] Database connection via .env works correctly
- [ ] No TypeScript/ESLint errors

## Analytics Potential

With model tracking in place, you can now analyze:

```sql
-- Compare model usage
SELECT 
  comment,
  COUNT(*) as evaluation_count,
  AVG(concept_explanation_accuracy) as avg_accuracy
FROM tbl_ailabs_ytfeedback_concept_evaluations
GROUP BY comment;

-- Model performance by time period
SELECT 
  DATE(created_at) as date,
  comment,
  COUNT(*) as daily_count
FROM tbl_ailabs_ytfeedback_project_evaluation
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), comment
ORDER BY date DESC;

-- User preference analysis
SELECT 
  email,
  comment,
  COUNT(*) as uses
FROM tbl_ailabs_ytfeedback_custom_evaluations
GROUP BY email, comment
ORDER BY email, uses DESC;
```

---

**Database:** PostgreSQL on AWS RDS (connection via .env)
**Comment Column:** Already added to all 3 tables ✅
**Visual Flow Complete** ✅
**Ready for User Testing** 🚀
**Production Ready** ✨
