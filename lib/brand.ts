import { z } from "zod";

export const BrandProfileSchema = z.object({
  name: z.string(),
  tone: z.string(),
  studioRules: z.object({
    must: z.array(z.string()),
    mustNot: z.array(z.string()),
  }),
  streetRules: z.object({
    must: z.array(z.string()),
    mustNot: z.array(z.string()),
  }),
});

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

export const BRAND_PROFILE: BrandProfile = {
  name: "flowerstore.ph",
  tone: "warm, aspirational, Filipino-market-aware",
  studioRules: {
    must: [
      "product-forward composition",
      "graphic or pastel backgrounds",
      "structured, grid-based layouts",
      "promotional messaging with prices and urgency",
      "clean, legible typography with no misspellings",
    ],
    mustNot: [
      "outdoor or urban environments",
      "lifestyle or candid shots",
      "emotional or narrative framing",
      "organic, raw, or unpolished aesthetic",
    ],
  },
  streetRules: {
    must: [
      "real people in natural poses",
      "real urban or everyday environments",
      "candid, unposed composition",
      "natural, available light",
      "conversational text (optional, never promotional)",
      "clean typography with no misspellings",
    ],
    mustNot: [
      "prices, discounts, or calls to action",
      "promotional or sales language",
      "studio backdrops or artificial environments",
      "posed or catalog-style product shots",
    ],
  },
};
