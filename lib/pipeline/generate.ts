import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { BRAND_PROFILE } from "@/lib/brand";
import { gemini } from "@/lib/llm/gemini";
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

  return `You are the Creative Director for ${BRAND_PROFILE.name}.
Brand tone: ${BRAND_PROFILE.tone}.

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
  "deliverables": string[] (one descriptor per deliverable, e.g. "Feed post — product hero"),
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

  for (let attempt = 0; attempt < 3; attempt++) {
    rawOutput = await gemini({ system: systemPrompt, user: cdUserPrompt, json: true });
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

  const generatedImageUrls: string[] = [];
  for (const prompt of campaignPlan.imageBasePrompts) {
    const { imageUrl: dataUrl } = await nanoBanana({
      prompt,
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
