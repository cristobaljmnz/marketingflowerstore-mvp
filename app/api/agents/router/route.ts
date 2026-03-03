import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gemini, GEMINI_FLASH } from "@/lib/llm/gemini";

const InputSchema = z.object({
  userMessage: z.string(),
  styleSelector: z.enum(["auto", "studio", "street"]),
});

const LLMOutputSchema = z.object({
  style: z.enum(["studio", "street"]),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are a creative style classifier for flowerstore.ph ad campaigns.

Classify the user's request into one of two creative styles:
- "studio": promotional intent — prices, urgency, product-forward, graphic/pastel backgrounds, structured layouts, no real people
- "street": lifestyle intent — emotional, relatable, real people, natural urban environments, no CTAs or prices

Return JSON with:
- style: "studio" or "street"
- confidence: number from 0.0 to 1.0 representing how confident you are in the classification`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = InputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: input.error.flatten() }, { status: 400 });
  }

  const { userMessage, styleSelector } = input.data;

  if (styleSelector !== "auto") {
    return NextResponse.json({
      style: styleSelector,
      confidence: 1.0,
      ambiguous: false,
    });
  }

  try {
    const result = await gemini({
      model: GEMINI_FLASH,
      system: SYSTEM_PROMPT,
      user: userMessage || "No description provided.",
      schema: LLMOutputSchema,
    });

    return NextResponse.json({
      style: result.style,
      confidence: result.confidence,
      ambiguous: result.confidence < 0.65,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
