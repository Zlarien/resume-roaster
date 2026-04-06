"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const cors = require("cors");

const app = express();

const SYSTEM_PROMPT =
  "Tu es un recruteur de la Silicon Valley extrêmement cynique et pressé. Analyse ce CV et fais une critique brutale et sarcastique. Ne prends pas de gants, mais donne 3 conseils concrets pour que ce candidat survive au premier tri.";

const PORT = Number(process.env.PORT || 7860);
const LLM_PROVIDER = (process.env.LLM_PROVIDER || "huggingface").toLowerCase();
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 6);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_RESUME_CHARS = 12000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.static(path.resolve(__dirname)));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: LLM_PROVIDER,
  });
});

app.post("/api/roast", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Missing resume file. Use form-data key 'resume'.",
      });
    }

    const resumeText = await extractResumeText(req.file);
    const normalizedText = normalizeResumeText(resumeText);

    if (!normalizedText) {
      return res.status(400).json({
        error: "Could not extract readable text from this file.",
      });
    }

    const feedback = await generateRoast(normalizedText);

    return res.json({
      feedback,
      meta: {
        provider: LLM_PROVIDER,
        model:
          LLM_PROVIDER === "openai"
            ? process.env.OPENAI_MODEL || "gpt-4o-mini"
            : LLM_PROVIDER === "groq"
            ? process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
            : process.env.HF_MODEL || "meta-llama/Llama-3.1-8B-Instruct",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Resume Roaster running on http://localhost:${PORT}`);
});

function normalizeResumeText(input) {
  const cleaned = String(input || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.slice(0, MAX_RESUME_CHARS);
}

async function extractResumeText(file) {
  const fileName = (file.originalname || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  if (fileName.endsWith(".pdf") || mime.includes("pdf")) {
    const parsed = await pdfParse(file.buffer);
    return parsed.text || "";
  }

  if (
    fileName.endsWith(".docx") ||
    mime.includes("officedocument.wordprocessingml.document")
  ) {
    const parsed = await mammoth.extractRawText({
      buffer: file.buffer,
    });
    return parsed.value || "";
  }

  if (fileName.endsWith(".txt") || mime.startsWith("text/")) {
    return file.buffer.toString("utf8");
  }

  throw new Error("Unsupported file type. Allowed: PDF, DOCX, TXT.");
}

function buildUserPrompt(resumeText) {
  return [
    "Voici le contenu du CV à analyser:",
    "",
    "===== CV START =====",
    resumeText,
    "===== CV END =====",
    "",
    "Réponds en français avec ce format:",
    "1) Roast brutal (court, sarcastique)",
    "2) Top 5 faiblesses concrètes",
    "3) 3 conseils actionnables pour survivre au premier tri",
  ].join("\n");
}

async function generateRoast(resumeText) {
  const mergedPrompt = SYSTEM_PROMPT;

  if (LLM_PROVIDER === "openai") {
    return generateWithOpenAI(resumeText, mergedPrompt);
  }

  if (LLM_PROVIDER === "groq") {
    return generateWithGroq(resumeText, mergedPrompt);
  }

  if (LLM_PROVIDER === "huggingface") {
    return generateWithHuggingFace(resumeText, mergedPrompt);
  }

  throw new Error("Invalid LLM_PROVIDER. Use 'openai', 'groq' or 'huggingface'.");
}

async function generateWithOpenAI(resumeText, systemPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in environment.");
  }

  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: buildUserPrompt(resumeText),
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const details = data && data.error ? JSON.stringify(data.error) : "OpenAI error";
    throw new Error(details);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenAI response did not contain usable text.");
  }

  return text.trim();
}

async function generateWithHuggingFace(resumeText, systemPrompt) {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    throw new Error("HF_API_KEY is missing in environment.");
  }

  const model = process.env.HF_MODEL || "meta-llama/Llama-3.1-8B-Instruct";
  const prompt = [
    `System: ${systemPrompt}`,
    "",
    buildUserPrompt(resumeText),
    "",
    "Assistant:",
  ].join("\n");

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 700,
          temperature: 0.9,
          return_full_text: false,
        },
        options: {
          wait_for_model: true,
          use_cache: false,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const details = data && data.error ? data.error : "Hugging Face error";
    throw new Error(String(details));
  }

  let text = "";
  if (Array.isArray(data) && data[0] && typeof data[0].generated_text === "string") {
    text = data[0].generated_text;
  } else if (data && typeof data.generated_text === "string") {
    text = data.generated_text;
  }

  if (!text.trim()) {
    throw new Error("Hugging Face response did not contain usable text.");
  }

  return text.trim();
}

async function generateWithGroq(resumeText, systemPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing in environment.");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: buildUserPrompt(resumeText),
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const details = data && data.error ? JSON.stringify(data.error) : "Groq error";
    throw new Error(details);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Groq response did not contain usable text.");
  }

  return text.trim();
}
