---
title: Resume Roaster
emoji: 🔥
colorFrom: red
colorTo: orange
sdk: docker
app_port: 7860
---

# Resume Roaster

[🇫🇷 Version française](./README.fr.md)

Drop your resume — get brutal, honest AI feedback to make it stand out.

Production-ready starter for GitHub + Hugging Face Spaces (Docker), with:

- upload CV (PDF / DOCX / TXT)
- backend extraction pipeline
- LLM provider abstraction (`groq`, `huggingface`, or `openai`)
- fallback demo mode in UI
- static frontend variant (`public/index.static.html`) for separate hosting

## 1) Stack

- Node.js 18+
- Express + Multer
- `pdf-parse` for PDF
- `mammoth` for DOCX
- Groq Chat Completions, Hugging Face Inference API, or OpenAI Chat Completions

## 2) Quick Start (local)

```bash
npm install
cp .env.example .env
```

Then edit `.env` with your provider/API key.

```bash
npm start
```

Open: `http://localhost:7860`

## 3) Environment Variables

See `.env.example`.

Minimum required:

- If `LLM_PROVIDER=groq`:
  - `GROQ_API_KEY`
  - optional `GROQ_MODEL` (default: `llama-3.3-70b-versatile`)
- If `LLM_PROVIDER=huggingface`:
  - `HF_API_KEY`
  - optional `HF_MODEL`
- If `LLM_PROVIDER=openai`:
  - `OPENAI_API_KEY`
  - optional `OPENAI_MODEL`

Groq endpoint used by backend:

- `POST https://api.groq.com/openai/v1/chat/completions`

## 4) API Contract

### `POST /api/roast`

`multipart/form-data`

- `resume`: file (PDF, DOCX, TXT)
- `systemInstruction`: accepted but backend enforces official server-side prompt for safety

Success:

```json
{
  "feedback": "...",
  "meta": {
    "provider": "huggingface",
    "model": "meta-llama/Llama-3.1-8B-Instruct"
  }
}
```

## 5) Hugging Face Spaces Deployment (Recommended)

This repository is already configured for **Docker Space** in the README front-matter.

### Steps

1. Create a new **Docker Space** on Hugging Face.
2. Push this repository.
3. In Space **Settings → Variables and secrets**, add secrets:
   - `LLM_PROVIDER`
   - `GROQ_API_KEY` (if Groq provider)
   - `HF_API_KEY` or `OPENAI_API_KEY`
   - optional model vars
4. Space builds and serves on port `7860`.

## 6) Local test recipe (Groq provider)

Use these exact commands:

```bash
cp .env.example .env
```

Set in `.env`:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_real_key
GROQ_MODEL=llama-3.3-70b-versatile
```

Then run:

```bash
npm install
npm run check
npm start
```

In another terminal, verify backend health:

```bash
curl http://localhost:7860/health
```

Expected: JSON with `"ok": true` and `"provider": "groq"`.

## 7) Connect to your personal website

You have 3 robust options:

1. **Direct Space URL**
   - Use your Space URL directly (`https://<owner>-<space>.hf.space`).
2. **Custom domain on Hugging Face (PRO)**
   - Configure Space custom domain + DNS CNAME.
3. **Reverse proxy (recommended for full control)**
   - Put Nginx/Caddy/Cloudflare in front of Space API and route `/api/roast` from your main domain.

For a static site calling your Space/backend API, set:

- frontend `window.RESUME_ROASTER_API_BASE`
- backend `CORS_ORIGIN=https://your-domain.com`

Example reverse-proxy flow:

- `https://your-domain.com` (website)
- `https://api.your-domain.com/api/roast` (proxy to Space/backend)

## 8) Static Frontend Option

If you host frontend separately (GitHub Pages / static host), use:

- `public/index.static.html`

Before loading the script, set API base URL:

```html
<script>
  window.RESUME_ROASTER_API_BASE = "https://your-api-domain.com";
</script>
```

Then the page calls `https://your-api-domain.com/api/roast`.

Set `CORS_ORIGIN` in backend `.env` accordingly.

## 9) Security Notes

- Never commit `.env`
- Keep API keys only in environment/secrets
- Keep server-side system prompt authoritative
- Limit upload size with `MAX_FILE_SIZE_MB`

## 10) Project Structure

```
.
├── index.html                # Main UI served by Express
├── public/
│   └── index.static.html     # Static-only frontend variant
├── server.js                 # API + extraction + provider logic
├── package.json
├── .env.example
├── .gitignore
├── Dockerfile
└── README.md
```

## 11) Troubleshooting

- `HF_API_KEY is missing in environment.`
  - add key in `.env` or HF Space secrets
- `GROQ_API_KEY is missing in environment.`
  - set Groq key in `.env` or HF Space secrets
- `Could not extract readable text`
  - try a text-based PDF/DOCX (scanned image PDFs need OCR)
- `API error (4xx/5xx)` in frontend
  - check backend logs and provider credentials/model access

## 12) Quality checklist

- `npm run check` passes
- `GET /health` responds with `{ "ok": true, ... }`
- `.env` is not committed (`.gitignore` protects it)
- `package-lock.json` is tracked for reproducible installs
