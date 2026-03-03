import { z } from "zod";

export const TextOverlaySchema = z.object({
  text: z.string(),
  position: z.string(),
  style: z.string(),
});

export const SUPPORTED_RESOLUTIONS = ["1200x1200", "1080x1350", "1080x1920"] as const;
export type SupportedResolution = typeof SUPPORTED_RESOLUTIONS[number];

export const CampaignPlanSchema = z.object({
  style: z.enum(["studio", "street"]),
  confidence: z.number().min(0).max(1),
  campaignTitle: z.string(),
  creativeIntent: z.enum(["promo", "emotional"]),
  deliverables: z.array(z.string()).length(5),
  imageBasePrompts: z.array(z.string()).length(5),
  textOverlays: z.array(TextOverlaySchema),
  captionOptions: z.array(z.string()),
  hashtags: z.array(z.string()),
  metadata: z.object({
    product: z.string(),
    style: z.enum(["studio", "street"]),
    intent: z.enum(["promo", "emotional"]),
    date: z.string(),
    referenceIds: z.array(z.string()),
    platformResolutions: z.array(z.enum(SUPPORTED_RESOLUTIONS)).length(5),
  }),
});

export type TextOverlay = z.infer<typeof TextOverlaySchema>;
export type CampaignPlan = z.infer<typeof CampaignPlanSchema>;
