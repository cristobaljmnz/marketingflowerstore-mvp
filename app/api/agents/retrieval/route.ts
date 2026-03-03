import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gemini, GEMINI_FLASH } from "@/lib/llm/gemini";
import { supabaseStorage } from "@/lib/storage/supabase";

const InputSchema = z.object({
  style: z.enum(["studio", "street"]),
  userMessage: z.string(),
  topK: z.number().int().min(3).max(6),
});

const LLMOutputSchema = z.object({
  retrievedAds: z.array(
    z.object({ id: z.string(), summary: z.string() })
  ),
});

const SYSTEM_PROMPT = `You are a creative reference selector for flowerstore.ph ad campaigns.

Given a user's ad request and a list of historical ads, select the most relevant ads based on theme, tone, seasonality, and visual patterns.

Return JSON with:
- retrievedAds: array of selected ads, each with { id: string, summary: string }
  where summary is a one-sentence description of why this ad is relevant.

Only select ads from the provided list. Do not invent or modify IDs.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = InputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: input.error.flatten() }, { status: 400 });
  }

  const { style, userMessage, topK } = input.data;

  try {
    const allAds = await supabaseStorage.getHistoricalAds(style);

    if (allAds.length === 0) {
      return NextResponse.json({
        retrievedAds: [],
        warning: `No historical ads found for style "${style}".`,
      });
    }

    if (allAds.length <= topK) {
      return NextResponse.json({
        retrievedAds: allAds.map((ad) => ({
          id: ad.id,
          summary: ad.description ?? ad.title ?? "Historical ad reference.",
        })),
        warning: `Only ${allAds.length} ads available for style "${style}".`,
      });
    }

    const adList = allAds
      .map(
        (ad) =>
          `- id: ${ad.id}, title: "${ad.title ?? "(untitled)"}", description: "${ad.description ?? "(none)"}"`
      )
      .join("\n");

    const userPrompt = `User request: "${userMessage}"\n\nSelect the ${topK} most relevant ads from:\n${adList}`;

    const result = await gemini({
      model: GEMINI_FLASH,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: LLMOutputSchema,
    });

    // Validate: only return IDs that exist in the loaded ads
    const validIds = new Set(allAds.map((ad) => ad.id));
    const validated = result.retrievedAds
      .filter((ad) => validIds.has(ad.id))
      .slice(0, topK);

    return NextResponse.json({ retrievedAds: validated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
