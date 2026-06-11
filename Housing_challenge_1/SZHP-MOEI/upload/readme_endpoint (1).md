# Recentech AI Worker — API Reference for Developers

**Base URL:** `https://recentech-ai-worker.42abudhabi424242.workers.dev`

---

## Quick Start

### 1. Get Your API Key

Ask the admin for an API key. It looks like:

```
rk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 2. Configure Z.AI SDK (Zero Code Changes)

Create a `.z-ai-config` file in your project root:

```json
{
  "baseUrl": "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1",
  "apiKey": "rk_your_key_here"
}
```

That's it — all your existing Z.AI SDK code works unchanged.

### 3. Or Use Direct Fetch

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/chat/completions" \
  -H "Authorization: Bearer rk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}], "model": "glm-4-flash"}'
```

---

## Authentication

Every request (except `/health`) requires your API key:

| Method | Example |
|--------|---------|
| **Header** | `Authorization: Bearer rk_your_key_here` |
| **Query** | `?key=rk_your_key_here` |

> **Security:** Your plain API key is never stored in our database — only its SHA-256 hash. This means even if the database is compromised, your key cannot be reversed.

---

## Z.AI SDK — All Methods

```javascript
import ZAI from 'z-ai-web-dev-sdk';

const zai = await ZAI.create();
```

### LLM Chat

```javascript
const response = await zai.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'glm-4-flash',
});
```

### LLM Chat — Streaming

```javascript
const stream = await zai.chat.completions.create({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  model: 'glm-4-flash',
  stream: true,
});
```

### VLM Vision

```javascript
const vision = await zai.chat.completions.createVision({
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Describe this image' },
      { type: 'image_url', image_url: { url: 'https://example.com/photo.jpg' } }
    ]
  }],
  model: 'glm-4v-plus',
});
```

### TTS (Text-to-Speech)

```javascript
const tts = await zai.audio.tts.create({
  input: 'Hello world',
  voice: 'tongtong',
  response_format: 'mp3',
});
```

### ASR (Speech-to-Text)

```javascript
const asr = await zai.audio.asr.create({
  file_base64: '<base64-audio>',
  language: 'en',
});
```

### Image Generation

```javascript
const image = await zai.images.generations.create({
  prompt: 'A mountain landscape at sunset',
  size: '1344x768',
});
```

### Image Editing

```javascript
const edited = await zai.images.generations.edit({
  prompt: 'Add a sunset background',
  image: 'data:image/png;base64,...',
});
```

### Image Search

```javascript
const search = await zai.images.search.create({
  query: 'cute cats',
  count: 5,
});
```

### Video Generation (Async)

```javascript
// Start generation
const video = await zai.video.generations.create({
  prompt: 'Ocean waves at sunset',
  duration: 5,
  fps: 30,
});

// Check status
const status = await zai.async.result.query({ id: video.id });
```

### Web Search

```javascript
const results = await zai.functions.invoke('web_search', {
  query: 'Latest AI news',
  num: 10,
});
```

### Page Reader

```javascript
const page = await zai.functions.invoke('page_reader', {
  url: 'https://example.com/article',
});
```

---

## Direct Fetch Reference

Same endpoints, no SDK needed.

### LLM Chat

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/chat/completions" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}], "model": "glm-4-flash"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "choices": [
      {"message": {"role": "assistant", "content": "Hello! How can I help?"}, "finish_reason": "stop"}
    ],
    "model": "glm-4-flash",
    "usage": {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18}
  }
}
```

### LLM Chat — Streaming

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/chat/completions" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}], "model": "glm-4-flash", "stream": true}'
```

**SSE format:**
```
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant","content":"Hello"}}]}
data: {"id":"...","choices":[{"delta":{"content":"!"}}]}
data: {"id":"...","choices":[{"finish_reason":"stop","delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}
data: [DONE]
```

### VLM Vision

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/chat/completions/vision" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": [
      {"type": "text", "text": "Describe this image"},
      {"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}}
    ]}],
    "model": "glm-4v-plus",
    "stream": true
  }'
```

### TTS

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/audio/tts" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello world", "voice": "tongtong", "response_format": "mp3"}' \
  --output speech.mp3
```

### ASR

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/audio/asr" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"file_base64": "<base64-audio>", "language": "en"}'
```

### Image Generation

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/images/generations" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A mountain landscape", "size": "1344x768"}'
```

### Image Editing

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/images/generations/edit" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add sunset", "image": "data:image/png;base64,..."}'
```

### Image Search

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/images/search" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"query": "cute cats", "count": 5}'
```

### Video Generation

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/video/generation" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Ocean waves", "duration": 5, "fps": 30}'
```

### Video Status

```bash
curl -X GET "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/async-result?id=TASK_ID" \
  -H "Authorization: Bearer rk_your_key"
```

### Web Search

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/functions/invoke" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"function_name": "web_search", "arguments": {"query": "Latest AI news", "num": 10}}'
```

### Page Reader

```bash
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/v1/functions/invoke" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"function_name": "page_reader", "arguments": {"url": "https://example.com/article"}}'
```

---

## Gemini API

All Gemini API endpoints are available under `/gemini/*`:

```bash
# Generate content
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/gemini/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello!"}]}]}'

# Streaming
curl -X POST "https://recentech-ai-worker.42abudhabi424242.workers.dev/gemini/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse" \
  -H "Authorization: Bearer rk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Tell me a story"}]}]}'
```

---

## Complete Endpoint Table

### Z.AI SDK Paths (Recentech AI)

| SDK Method | HTTP | Path |
|-----------|------|------|
| `zai.chat.completions.create()` | POST | `/v1/chat/completions` |
| `zai.chat.completions.createVision()` | POST | `/v1/chat/completions/vision` |
| `zai.audio.tts.create()` | POST | `/v1/audio/tts` |
| `zai.audio.asr.create()` | POST | `/v1/audio/asr` |
| `zai.images.generations.create()` | POST | `/v1/images/generations` |
| `zai.images.generations.edit()` | POST | `/v1/images/generations/edit` |
| `zai.images.search.create()` | POST | `/v1/images/search` |
| `zai.video.generations.create()` | POST | `/v1/video/generation` |
| `zai.async.result.query()` | GET | `/v1/async-result?id={taskId}` |
| `zai.functions.invoke('web_search', ...)` | POST | `/v1/functions/invoke` |
| `zai.functions.invoke('page_reader', ...)` | POST | `/v1/functions/invoke` |

### Gemini Paths

| Service | HTTP | Path |
|---------|------|------|
| Generate Content | POST | `/gemini/v1beta/models/{model}:generateContent` |
| Stream Generate | POST | `/gemini/v1beta/models/{model}:streamGenerateContent?alt=sse` |
| Embed | POST | `/gemini/v1beta/models/{model}:embedContent` |
| Count Tokens | POST | `/gemini/v1beta/models/{model}:countTokens` |
| List Models | GET | `/gemini/v1beta/models` |
| File Upload | POST | `/gemini/upload/v1beta/files` |
| Live API | WSS | `/gemini/ws/...BidiGenerateContent` |

---

## Available Models

### LLM

| Model | Best For |
|-------|----------|
| `glm-5.1` | Latest, advanced reasoning |
| `glm-5` | High-quality generation |
| `glm-5-turbo` | Fast responses |
| `glm-5-plus` | Complex reasoning |
| `glm-4-plus` | **Default** — general purpose |
| `glm-4-flash` | Ultra-fast, simple tasks |
| `glm-4-long` | Long documents |
| `glm-4` | Standard generation |
| `glm-4-air` | Lightweight tasks |

### VLM

| Model | Best For |
|-------|----------|
| `glm-4v` | Basic image understanding |
| `glm-4v-plus` | **Default** — enhanced analysis |
| `glm-5v` | Advanced visual understanding |
| `glm-5.1v` | Latest vision model |

### Gemini

| Model | Best For |
|-------|----------|
| `gemini-2.5-flash` | Fast, general purpose |
| `gemini-2.5-pro` | Complex reasoning |
| `gemini-2.0-flash` | Fast responses |

---

## Health Check

```bash
curl https://recentech-ai-worker.42abudhabi424242.workers.dev/health
```

```json
{
  "status": "ok",
  "service": "recentech-ai-worker",
  "version": "2.1.0",
  "providers": {
    "gemini": { "configured": true, "baseUrl": "/gemini" },
    "recentech": { "configured": true, "baseUrl": "/v1" }
  },
  "auth": { "database": "connected", "apiKeyCount": 5 }
}
```

---

## Error Responses

### 401 — Unauthorized

```json
{"error": {"code": 401, "message": "API key required. Provide via Authorization: Bearer <key> or ?key=<key>"}}
{"error": {"code": 401, "message": "Invalid or disabled API key"}}
```

### 404 — Not Found

```json
{"error": {"code": 404, "message": "Not found. Use /v1/* (Z.AI SDK), /gemini/*, or /recentech/* paths."}}
```

### 502 — Proxy Error

```json
{"error": {"code": 502, "message": "Proxy error: <details>"}}
```

---

## How It Works

```
┌──────────────────────┐     ┌───────────────────────────────────┐     ┌───────────────────────┐
│  Your App            │────▶│  Worker                            │────▶│  Recentech AI         │
│  .z-ai-config:       │     │  1. SHA-256 hash your API key     │     │  j178y4rq3621-d       │
│  baseUrl=.../v1      │     │  2. Look up hash in D1            │     │  .space-z.ai          │
│  apiKey=rk_your_key  │◀────│  3. Replace with secret key       │◀────│                       │
│                      │     │  4. Stream response back           │     │                       │
└──────────────────────┘     └───────────────────────────────────┘     └───────────────────────┘

SDK calls:                       Worker forwards:
/v1/chat/completions        →    https://j178y4rq3621-d.space-z.ai/v1/chat/completions
/v1/audio/tts               →    https://j178y4rq3621-d.space-z.ai/v1/audio/tts
/v1/images/generations      →    https://j178y4rq3621-d.space-z.ai/v1/images/generations
...same path, different key      ...with the real secret key injected
```

> **Key security:** Your API key is hashed (SHA-256) before lookup. The plain key is never stored in D1.
