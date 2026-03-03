import { z } from "zod";
import { CampaignPlanSchema } from "./campaign-plan";

export const GeneratedCampaignSchema = z.object({
  id: z.string().uuid(),
  productImageUrl: z.string().url(),
  generatedImageUrls: z.array(z.string().url()),
  campaignPlan: CampaignPlanSchema,
  style: z.enum(["studio", "street"]),
  intent: z.enum(["promo", "emotional"]),
  captionOptions: z.array(z.string()),
  hashtags: z.array(z.string()),
  referenceIds: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export type GeneratedCampaign = z.infer<typeof GeneratedCampaignSchema>;
