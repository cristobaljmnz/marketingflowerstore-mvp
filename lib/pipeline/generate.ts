import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { BRAND_PROFILE } from "@/lib/brand";
import { gemini, GEMINI_FLASH, GEMINI_PRO } from "@/lib/llm/gemini";
import { nanoBanana } from "@/lib/llm/nano-banana";
import { supabaseStorage } from "@/lib/storage/supabase";
import { CampaignPlanSchema, type CampaignPlan } from "@/lib/schema/campaign-plan";
import { GeneratedCampaignSchema } from "@/lib/schema/generated-campaign";

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelineStep =
  | "router"
  | "retrieval"
  | "creative-director"
  | "image-generation"
  | "saving";

export type StepStatus = "running" | "done" | "error";

export interface ProgressEvent {
  step: PipelineStep;
  status: StepStatus;
  style?: "studio" | "street"; // present for fork variants
  error?: string;
}

export interface PipelineInput {
  productImageUrl: string;
  userMessage: string;
  styleSelector: "auto" | "studio" | "street";
}

export interface PipelineVariant {
  style: "studio" | "street";
  campaignPlan: CampaignPlan;
  generatedImageUrls: string[];
  savedId: string;
}

export interface PipelineResult {
  variants: PipelineVariant[];
}

type OnProgress = (event: ProgressEvent) => void;

// ── Agent system prompts ──────────────────────────────────────────────────────

const ROUTER_SYSTEM_PROMPT = `You are a creative style classifier for flowerstore.ph ad campaigns.

Classify the user's request into one of two creative styles:
- "studio": promotional intent — prices, urgency, product-forward, graphic/pastel backgrounds, structured layouts, no real people
- "street": lifestyle intent — emotional, relatable, real people, natural urban environments, no CTAs or prices

Return JSON with:
- style: "studio" or "street"
- confidence: number from 0.0 to 1.0 representing how confident you are in the classification`;

const RouterOutputSchema = z.object({
  style: z.enum(["studio", "street"]),
  confidence: z.number().min(0).max(1),
});

const RETRIEVAL_SYSTEM_PROMPT = `You are a creative reference selector for flowerstore.ph ad campaigns.

Given a user's ad request and a list of historical ads, select the most relevant ads based on theme, tone, seasonality, and visual patterns.

Return JSON with:
- retrievedAds: array of selected ads, each with { id: string, summary: string }
  where summary is a one-sentence description of why this ad is relevant.

Only select ads from the provided list. Do not invent or modify IDs.`;

const RetrievalOutputSchema = z.object({
  retrievedAds: z.array(z.object({ id: z.string(), summary: z.string() })),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCreativeDirectorSystemPrompt(style: "studio" | "street"): string {
  const rules =
    style === "studio" ? BRAND_PROFILE.studioRules : BRAND_PROFILE.streetRules;

  const studioSeasonalBlock =
    style === "studio"
      ? `STUDIO — SEASONAL & FESTIVITY ADAPTATION (MANDATORY)
Today's date: ${new Date().toISOString().slice(0, 10)}

Studio campaigns must visually adapt to the current season and any culturally relevant Philippine festivities near this date.

Adaptation applies to:
- Color palette choices
- Decorative motifs and graphic accents
- Background elements and texture

Adaptation must NOT override:
- Product-first composition
- Structured promotional layout
- Pricing, urgency, and commercial clarity

INFERENCE RULES:
- If the user explicitly mentions a festivity or occasion, apply its visual language.
- If no festivity is mentioned, infer from today's date what seasonal or cultural context is most relevant in the Philippines.
- If no major festivity is near, use neutral seasonal tones appropriate to the current month and climate.

PHILIPPINE FESTIVITY REFERENCE (directional, not exhaustive):
- Valentine's Day (Feb 14): dominant reds, heart motifs, romantic graphic accents
- Holy Week / Easter (Mar–Apr): soft pastels, nature motifs, reflective quiet tones
- Mother's Day (2nd Sunday of May): warm pinks, floral abundance, loving warmth
- Independence Day (Jun 12): patriotic tones, subtle Filipino cultural accents
- Christmas Season (Nov–Jan): red and green dominant, ornaments, festive lights, holiday decorative elements
- New Year (Jan 1): fireworks motifs, sparkle elements, celebration-themed accents
- Summer (Apr–May): tropical floral accents, warmer tones, bright lively backgrounds
- Ber months / Holiday buildup (Sep–Dec): growing festive warmth, transitioning toward Christmas palette

CONSTRAINT:
- Always respect Studio compositional rules — structured layout, product primary.
- Seasonal motifs are visual accents only; they are never the subject.
- Never drift into street, lifestyle, or editorial aesthetic.`
      : "";

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

  return `You are the Creative Director for ${BRAND_PROFILE.name}.
Brand tone: ${BRAND_PROFILE.tone}.

Selected style: ${style.toUpperCase()} — apply exclusively. Do not blend with the other style.

${style.toUpperCase()} RULES
Must: ${rules.must.join("; ")}.
Must NOT: ${rules.mustNot.join("; ")}.
${studioSeasonalBlock ? `\n${studioSeasonalBlock}\n` : ""}${streetTechBlock ? `\n${streetTechBlock}\n` : ""}
CRITICAL — PRODUCT FIDELITY (applies to every imageBasePrompt you write)
The product image provided is the EXACT item being promoted.
- DO NOT change the flowers: not their color, variety, count, or arrangement.
- DO NOT change the wrapping paper or ribbon: not their color, texture, or pattern.
- DO NOT idealize, substitute, or reimagine the product in any way.
- You MAY describe premium environmental effects around the bouquet: soft bokeh, luxury lighting, delicate light rays, subtle glow — as long as these effects do not alter the product itself.
- Every imageBasePrompt must end with: "Reproduce the product exactly as shown in the reference photo."

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

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
  return { buffer: Buffer.from(base64, "base64"), mimeType };
}

function mimeToExt(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

// ── Variant runner (steps 4–6: retrieval → creative-director → image-gen → save) ──

async function runVariant(
  style: "studio" | "street",
  styleConfidence: number,
  productImageUrl: string,
  userMessage: string,
  onProgress: OnProgress
): Promise<PipelineVariant> {
  const emit = (step: PipelineStep, status: StepStatus) =>
    onProgress({ step, status, style });

  // Step: retrieval
  emit("retrieval", "running");

  const allAds = await supabaseStorage.getHistoricalAds(style);
  const topK = 5;
  let retrievedAds: Array<{ id: string; summary: string }> = [];

  if (allAds.length === 0) {
    // no ads — proceed with empty references
  } else if (allAds.length <= topK) {
    retrievedAds = allAds.map((ad) => ({
      id: ad.id,
      summary: ad.description ?? ad.title ?? "Historical ad reference.",
    }));
  } else {
    const adList = allAds
      .map(
        (ad) =>
          `- id: ${ad.id}, title: "${ad.title ?? "(untitled)"}", description: "${ad.description ?? "(none)"}"`
      )
      .join("\n");
    const userPrompt = `User request: "${userMessage}"\n\nSelect the ${topK} most relevant ads from:\n${adList}`;

    const result = await gemini({
      model: GEMINI_FLASH,
      system: RETRIEVAL_SYSTEM_PROMPT,
      user: userPrompt,
      schema: RetrievalOutputSchema,
    });

    const validIds = new Set(allAds.map((ad) => ad.id));
    retrievedAds = result.retrievedAds
      .filter((ad) => validIds.has(ad.id))
      .slice(0, topK);
  }

  emit("retrieval", "done");

  // Step: creative-director (with up to 3 attempts)
  emit("creative-director", "running");

  const systemPrompt = buildCreativeDirectorSystemPrompt(style);
  const adRefs =
    retrievedAds.length > 0
      ? retrievedAds.map((ad) => `- ${ad.id}: ${ad.summary}`).join("\n")
      : "(none provided)";

  let cdUserPrompt = `User request: "${userMessage}"

Product image URL (primary visual reference): ${productImageUrl}
Style confidence: ${styleConfidence}

Historical ad references (use for creative inspiration):
${adRefs}

Generate a complete ${style} campaign plan.`;

  let campaignPlan: CampaignPlan | null = null;
  let rawOutput = "";

  // Model cascade: try PRO (120s) first; fall back to FLASH (60s) on timeout
  async function callCD(model: string, timeoutMs: number, prompt: string): Promise<string> {
    return gemini({ model, system: systemPrompt, user: prompt, json: true, timeoutMs });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    let modelUsed = GEMINI_PRO;
    let timeoutUsed = 120_000;

    try {
      rawOutput = await callCD(GEMINI_PRO, 120_000, cdUserPrompt);
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("timed out")) {
        console.error("[creative-director] PRO timed out, falling back to FLASH");
        modelUsed = GEMINI_FLASH;
        timeoutUsed = 60_000;
        rawOutput = await callCD(GEMINI_FLASH, 60_000, cdUserPrompt);
      } else {
        throw err;
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.error(`[creative-director] attempt ${attempt + 1}, model: ${modelUsed}, timeout: ${timeoutUsed}ms`);
    }

    const parsed = CampaignPlanSchema.safeParse(JSON.parse(rawOutput));
    if (parsed.success) {
      campaignPlan = parsed.data;
      break;
    }
    if (attempt < 2) {
      cdUserPrompt += `\n\nYour previous response failed validation:\n${JSON.stringify(parsed.error.flatten())}\n\nFix all issues and return valid JSON.`;
    }
  }

  if (!campaignPlan) {
    throw new Error(
      `Creative Director validation failed after 3 attempts. Raw output: ${rawOutput}`
    );
  }

  emit("creative-director", "done");

  // Step: image-generation (sequential per prompt)
  emit("image-generation", "running");

  const FIDELITY_PREFIX =
    "IMPORTANT: The reference image shows the exact product to feature. " +
    "Reproduce it faithfully — preserve all flower colors, wrapping paper colors, " +
    "textures, and arrangement exactly as shown in the reference photo. " +
    "Do not alter, idealize, recolor, or substitute any part of the product. " +
    "You may add premium lighting effects, soft bokeh, or a subtle glow to enhance " +
    "the mood, but the product itself must match the reference photo precisely. ";

  const generatedImageUrls: string[] = [];
  for (const prompt of campaignPlan.imageBasePrompts) {
    const { imageUrl: dataUrl } = await nanoBanana({
      prompt: FIDELITY_PREFIX + prompt,
      referenceImageUrl: productImageUrl,
    });
    const { buffer, mimeType } = dataUrlToBuffer(dataUrl);
    const filename = `${uuidv4()}.${mimeToExt(mimeType)}`;
    const url = await supabaseStorage.uploadImage(
      "generated-campaigns",
      buffer,
      filename
    );
    generatedImageUrls.push(url);
  }

  emit("image-generation", "done");

  // Step: saving (librarian)
  emit("saving", "running");

  const campaign = GeneratedCampaignSchema.parse({
    id: uuidv4(),
    productImageUrl,
    generatedImageUrls,
    campaignPlan,
    style: campaignPlan.style,
    intent: campaignPlan.creativeIntent,
    captionOptions: campaignPlan.captionOptions,
    hashtags: campaignPlan.hashtags,
    referenceIds: campaignPlan.metadata.referenceIds,
    createdAt: new Date().toISOString(),
  });

  await supabaseStorage.saveGeneratedCampaign(campaign);

  emit("saving", "done");

  return {
    style,
    campaignPlan,
    generatedImageUrls,
    savedId: campaign.id,
  };
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runPipeline(
  input: PipelineInput,
  onProgress: OnProgress
): Promise<PipelineResult> {
  // Step 1: Router
  onProgress({ step: "router", status: "running" });

  let style: "studio" | "street";
  let confidence: number;
  let ambiguous: boolean;

  if (input.styleSelector !== "auto") {
    style = input.styleSelector;
    confidence = 1.0;
    ambiguous = false;
  } else {
    const result = await gemini({
      model: GEMINI_FLASH,
      system: ROUTER_SYSTEM_PROMPT,
      user: input.userMessage || "No description provided.",
      schema: RouterOutputSchema,
    });
    style = result.style;
    confidence = result.confidence;
    ambiguous = result.confidence < 0.65;
  }

  onProgress({ step: "router", status: "done" });

  // Steps 2–5: Run variant(s)
  if (ambiguous) {
    // Fork: run both studio and street sequentially
    const studioVariant = await runVariant(
      "studio",
      confidence,
      input.productImageUrl,
      input.userMessage,
      onProgress
    );
    const streetVariant = await runVariant(
      "street",
      confidence,
      input.productImageUrl,
      input.userMessage,
      onProgress
    );
    return { variants: [studioVariant, streetVariant] };
  }

  const variant = await runVariant(
    style,
    confidence,
    input.productImageUrl,
    input.userMessage,
    onProgress
  );
  return { variants: [variant] };
}
