import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gemini } from "@/lib/llm/gemini";
import { CampaignPlanSchema } from "@/lib/schema/campaign-plan";
import { BrandProfileSchema, type BrandProfile } from "@/lib/brand";

const InputSchema = z.object({
  userMessage: z.string(),
  productImageUrl: z.string().url(),
  style: z.enum(["studio", "street"]),
  styleConfidence: z.number(),
  retrievedAds: z.array(z.object({ id: z.string(), summary: z.string() })),
  brandProfile: BrandProfileSchema,
});

function buildSystemPrompt(
  style: "studio" | "street",
  brandProfile: BrandProfile
): string {
  const rules =
    style === "studio" ? brandProfile.studioRules : brandProfile.streetRules;

  return `You are the Creative Director for ${brandProfile.name}.
Brand tone: ${brandProfile.tone}.

Selected style: ${style.toUpperCase()} — apply exclusively. Do not blend with the other style.

${style.toUpperCase()} RULES
Must: ${rules.must.join("; ")}.
Must NOT: ${rules.mustNot.join("; ")}.

Produce a complete ad campaign plan as valid JSON matching this exact schema:
{
  "style": "${style}",
  "confidence": number (0.0–1.0),
  "campaignTitle": string,
  "creativeIntent": "promo" | "emotional",
  "deliverables": string[] (one descriptor per ad deliverable, e.g. "Feed post — product hero"),
  "imageBasePrompts": string[] (one detailed image generation prompt per deliverable, same length as deliverables),
  "textOverlays": [{ "text": string, "position": string, "style": string }],
  "captionOptions": string[] (exactly 3 caption variants),
  "hashtags": string[],
  "metadata": {
    "product": string (short product description),
    "style": "${style}",
    "intent": "promo" | "emotional",
    "date": string (today's ISO date),
    "referenceIds": string[] (IDs of referenced historical ads)
  }
}

Return only valid JSON. No markdown, no code fences, no explanation.`;
}

function buildUserPrompt(
  input: z.infer<typeof InputSchema>,
  previousError?: string
): string {
  const adRefs =
    input.retrievedAds.length > 0
      ? input.retrievedAds.map((ad) => `- ${ad.id}: ${ad.summary}`).join("\n")
      : "(none provided)";

  let prompt = `User request: "${input.userMessage}"

Product image URL (primary visual reference): ${input.productImageUrl}
Style confidence: ${input.styleConfidence}

Historical ad references (use for creative inspiration):
${adRefs}

Generate a complete ${input.style} campaign plan.`;

  if (previousError) {
    prompt += `\n\nYour previous response failed validation with these errors:\n${previousError}\n\nFix all issues and return valid JSON exactly matching the schema.`;
  }

  return prompt;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = InputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: input.error.flatten() }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(
    input.data.style,
    input.data.brandProfile
  );
  let userPrompt = buildUserPrompt(input.data);
  let rawOutput = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      rawOutput = await gemini({
        system: systemPrompt,
        user: userPrompt,
        json: true,
      });

      const parsed: unknown = JSON.parse(rawOutput);
      const result = CampaignPlanSchema.safeParse(parsed);

      if (result.success) {
        return NextResponse.json(result.data);
      }

      const errorDetails = JSON.stringify(result.error.flatten());
      userPrompt = buildUserPrompt(input.data, errorDetails);
    } catch (err) {
      if (attempt === 2) {
        return NextResponse.json(
          { error: "validation_failed", raw: rawOutput, detail: String(err) },
          { status: 422 }
        );
      }
      userPrompt = buildUserPrompt(input.data, String(err));
    }
  }

  return NextResponse.json(
    { error: "validation_failed", raw: rawOutput },
    { status: 422 }
  );
}
