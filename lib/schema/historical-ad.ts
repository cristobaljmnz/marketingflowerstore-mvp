import { z } from "zod";

export const HistoricalAdSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().url(),
  tag: z.enum(["studio", "street"]),
  title: z.string().optional(),
  description: z.string().optional(),
  uploadedAt: z.string().datetime(),
});

export type HistoricalAd = z.infer<typeof HistoricalAdSchema>;
