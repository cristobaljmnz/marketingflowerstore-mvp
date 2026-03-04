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

  const textHandlingBlock =
    style === "studio"
      ? `TEXT HANDLING — STUDIO
- If the user explicitly requests text on the image: leave intentional negative space in the composition; reserve clear areas suitable for typography; follow the overlay instructions.
- If the user does NOT mention text: generate a mix of compositions — some with generous negative space, some moderate, some tightly product-focused. At least 2 of the 5 variants must clearly allow future text placement.`
      : `TEXT HANDLING — STREET
- Do NOT create structured promotional layouts or reserved graphic space.
- Text (if any) must feel organic and minimal — like a casual caption, never promotional.
- Composition must feel like an authentic iPhone photo, not a designed ad.`;

  const streetTechBlock =
    style === "street"
      ? `STREET IMAGE PROMPT REQUIREMENTS — MANDATORY
Every imageBasePrompt for this street campaign MUST explicitly include ALL of the following phrases:
- "shot on iPhone"
- "natural daylight"
- "casual Instagram photo"
- "realistic depth of field"
- "no professional blur"
- "authentic social media look"

Every imageBasePrompt for this street campaign MUST NOT include or imply:
- "DSLR"
- "cinematic"
- "professional bokeh"
- "studio lighting"
- Any language that implies a high-end, editorial, or commercial photography production.

The image must feel like a spontaneous moment captured by an influencer — not a brand campaign, magazine shoot, or cinematic production.`
      : "";

  const studioTechBlock =
    style === "studio"
      ? `STUDIO IMAGE PROMPT REQUIREMENTS — MANDATORY
Every imageBasePrompt for this studio campaign MUST explicitly include ALL of the following phrases:
- "clean studio lighting"
- "commercial product photography"
- "polished e-commerce aesthetic"
- "graphic or pastel background"
- "controlled shadows"

Every imageBasePrompt for this studio campaign MUST NOT include or imply:
- "lifestyle"
- "urban environment"
- "candid"
- "shot on iPhone" or any smartphone-style language
- "natural daylight" as the primary light source
- Any language that implies a casual, outdoor, or uncontrolled environment.

The image must feel like a professional commercial product photo — polished, designed, and on-brand.`
      : "";

  const techBlock = style === "studio" ? studioTechBlock : streetTechBlock;

  return `You are the Creative Director for ${brandProfile.name}.
Brand tone: ${brandProfile.tone}.

Selected style: ${style.toUpperCase()} — apply exclusively. Do not blend with the other style.

${style.toUpperCase()} RULES
Must: ${rules.must.join("; ")}.
Must NOT: ${rules.mustNot.join("; ")}.
${techBlock ? `\n${techBlock}\n` : ""}
IMAGE GENERATION SPECIFICATION — MANDATORY
You must output EXACTLY 5 deliverables and EXACTLY 5 imageBasePrompts (one per deliverable).

SUPPORTED RESOLUTIONS (use only these three):
- 1200x1200  →  Facebook feed
- 1080x1350  →  Instagram feed (portrait)
- 1080x1920  →  Instagram story

RESOLUTION RULES:
1. DEFAULT (user does not mention a specific platform):
   - Deliverable 1: 1200x1200
   - Deliverable 2: 1200x1200
   - Deliverable 3: 1200x1200
   - Deliverable 4: 1080x1350
   - Deliverable 5: 1080x1920

2. PLATFORM OVERRIDE (user mentions a platform, e.g. "Instagram story", "Facebook post"):
   - Detect the platform from the user message.
   - Generate all 5 variants at the matching resolution.
   - Do not mix formats unless the user explicitly requests multiple formats.

Each imageBasePrompt MUST include the target resolution string (e.g. "1200x1200 image,") near the start of the prompt.
Each deliverable descriptor MUST include the resolution (e.g. "Facebook feed — 1200x1200 — product hero").
The metadata.platformResolutions array must list the 5 resolutions in order, one per deliverable.

${textHandlingBlock}

LIBRARY REFERENCES — PRIMARY VISUAL ANCHOR
The historical ad references provided are not optional inspiration — they are the primary stylistic anchor for this campaign.
Analyze each reference for:
- Composition structure (product placement, framing, negative space)
- Background style (color, texture, graphic elements)
- Color balance (dominant palette, accent colors)
- Graphic density (design weight vs. breathing room)
- Typography placement (where text lives relative to the product)

Your imageBasePrompts must reflect these visual patterns. New generations must feel stylistically consistent with the provided references.

Produce a complete ad campaign plan as valid JSON matching this exact schema:
{
  "style": "${style}",
  "confidence": number (0.0–1.0),
  "campaignTitle": string,
  "creativeIntent": "promo" | "emotional",
  "deliverables": string[] (EXACTLY 5 items — each includes resolution, e.g. "Facebook feed — 1200x1200 — product hero"),
  "imageBasePrompts": string[] (EXACTLY 5 items — each starts with resolution, ends with product fidelity instruction),
  "textOverlays": [{ "text": string, "position": string, "style": string }],
  "captionOptions": string[] (exactly 3 caption variants),
  "hashtags": string[],
  "metadata": {
    "product": string (short product description),
    "style": "${style}",
    "intent": "promo" | "emotional",
    "date": string (today's ISO date),
    "referenceIds": string[] (IDs of referenced historical ads),
    "platformResolutions": string[] (EXACTLY 5 values, one per deliverable, each must be "1200x1200", "1080x1350", or "1080x1920")
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

function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
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

      const parsed: unknown = JSON.parse(extractJsonObject(rawOutput));
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
