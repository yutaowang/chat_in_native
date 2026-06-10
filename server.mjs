import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8787);
const model = process.env.MODEL || "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const retryDelayMs = 30_000;
let translationFailure = null;

app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => {
  const failureActive = translationFailure && Date.now() - translationFailure.at < retryDelayMs;
  res.json({
    ok: true,
    translation: !apiKey ? "demo" : failureActive ? "unavailable" : "configured",
    model
  });
});

app.post("/api/translate", async (req, res) => {
  const { text, targetLanguage, sourceLanguage = "auto" } = req.body ?? {};

  if (!text?.trim() || !targetLanguage) {
    return res.status(400).json({ error: "text and targetLanguage are required" });
  }

  if (!apiKey) {
    return res.json({
      translatedText: text,
      detectedLanguage: sourceLanguage === "auto" ? "Unknown" : sourceLanguage,
      mode: "demo"
    });
  }

  if (translationFailure && Date.now() - translationFailure.at < retryDelayMs) {
    return res.status(503).json({
      error: translationFailure.message,
      code: translationFailure.code,
      mode: "unavailable"
    });
  }

  try {
    const endpoint = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: [
              "You are the translation engine for a messaging application.",
              "Preserve meaning, tone, names, emoji, URLs, line breaks, and formatting.",
              "Do not explain or answer the message.",
              "Return JSON only, with exactly these string fields:",
              '{"translatedText":"...","detectedLanguage":"..."}'
            ].join(" ")
          },
          {
            role: "user",
            content: `Source language: ${sourceLanguage}\nTarget language: ${targetLanguage}\nMessage:\n${text}`
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      const providerError = new Error(`Model request failed (${response.status}): ${detail}`);
      providerError.status = response.status;
      providerError.detail = detail;
      throw providerError;
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const raw = Array.isArray(content)
      ? content.map((part) => part?.text || part?.content || "").join("")
      : content;
    const jsonText = String(raw || "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const result = JSON.parse(jsonText);

    if (typeof result.translatedText !== "string" || typeof result.detectedLanguage !== "string") {
      throw new Error("Model returned an invalid translation payload");
    }

    translationFailure = null;
    res.json({ ...result, mode: "model", model });
  } catch (error) {
    console.error(error);
    const invalidKey = error.status === 401;
    translationFailure = {
      at: Date.now(),
      code: invalidKey ? "invalid_api_key" : "provider_error",
      message: invalidKey ? "Translation API key is invalid" : "Translation service unavailable"
    };
    res.status(invalidKey ? 401 : 502).json({
      error: translationFailure.message,
      code: translationFailure.code,
      mode: "unavailable"
    });
  }
});

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`chat_native server listening on http://localhost:${port}`);
});
