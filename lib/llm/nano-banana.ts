import { GoogleGenAI } from "@google/genai";

const NANO_BANANA_MODEL = "nano-banana-pro";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: key });
}

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export async function nanoBanana(params: {
  prompt: string;
  referenceImageUrl?: string;
}): Promise<{ imageUrl: string }> {
  const { prompt, referenceImageUrl } = params;
  const ai = getClient();

  if (process.env.NODE_ENV === "development") {
    console.error("[nano-banana] prompt:", prompt);
    if (referenceImageUrl)
      console.error("[nano-banana] reference:", referenceImageUrl);
  }

  const parts: Part[] = [{ text: prompt }];

  if (referenceImageUrl) {
    const res = await fetch(referenceImageUrl);
    if (!res.ok)
      throw new Error(`Failed to fetch reference image: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString("base64");
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    parts.unshift({ inlineData: { mimeType, data } });
  }

  const response = await ai.models.generateContent({
    model: NANO_BANANA_MODEL,
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["IMAGE"] },
  });

  const rawParts: unknown[] =
    response.candidates?.[0]?.content?.parts ?? [];

  type ImagePart = { inlineData: { mimeType: string; data: string } };

  const imagePart = rawParts.find((p): p is ImagePart => {
    const part = p as { inlineData?: { mimeType?: string } };
    return typeof part?.inlineData?.mimeType === "string" &&
      part.inlineData.mimeType.startsWith("image/");
  });

  if (!imagePart) {
    throw new Error("nano-banana returned no image in response");
  }

  const { mimeType, data } = imagePart.inlineData;
  const imageUrl = `data:${mimeType};base64,${data}`;

  if (process.env.NODE_ENV === "development") {
    console.error("[nano-banana] image received, mimeType:", mimeType);
  }

  return { imageUrl };
}
