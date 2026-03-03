import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const GEMINI_MODEL = "gemini-3.1-pro-preview";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: key });
}

function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string };
  const status = e.status ?? e.code;
  if (status && [429, 500, 502, 503, 504].includes(status)) return true;
  const msg = (e.message ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("503");
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1 || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error("Unreachable");
}

export async function gemini<T>(params: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
}): Promise<T>;

export async function gemini(params: {
  system: string;
  user: string;
  schema?: undefined;
  json?: boolean;
}): Promise<string>;

export async function gemini<T>(params: {
  system: string;
  user: string;
  schema?: z.ZodType<T>;
  json?: boolean;
}): Promise<T | string> {
  const { system, user, schema, json } = params;
  const ai = getClient();

  if (process.env.NODE_ENV === "development") {
    console.error("[gemini] system:", system);
    console.error("[gemini] user:", user);
  }

  const config: Record<string, unknown> = { systemInstruction: system };
  if (schema) {
    config.responseMimeType = "application/json";
    config.responseSchema = z.toJSONSchema(schema);
  } else if (json) {
    config.responseMimeType = "application/json";
  }

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: user,
      config,
    })
  );

  const text = response.text ?? "";

  if (process.env.NODE_ENV === "development") {
    console.error("[gemini] output:", text);
  }

  if (!schema) return text;

  return schema.parse(JSON.parse(text));
}
