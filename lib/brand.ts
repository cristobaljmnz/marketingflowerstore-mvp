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
      "shot as if taken with a recent iPhone — casual, handheld feel",
      "natural daylight — no cinematic or studio lighting",
      "slightly imperfect framing — perspective imperfections acceptable",
      "human presence encouraged — real people in natural poses",
      "organic everyday environment: home, street, café, or park",
      "natural hand positioning — never posed or catalog-style",
      "realistic depth of field — background remains clearly visible",
      "authentic social media aesthetic — feels like an Instagram post",
      "conversational text optional, never promotional",
      "clean typography with no misspellings",
    ],
    mustNot: [
      "dramatic depth-of-field blur or creamy DSLR bokeh",
      "fashion editorial, magazine, or cinematic production look",
      "ultra-symmetrical or over-polished composition",
      "artificial gradient backgrounds",
      "high-end commercial photography aesthetic",
      "cinematic lighting or professional studio light",
      "prices, discounts, or calls to action",
      "promotional or sales language",
      "studio backdrops or artificial environments",
    ],
  },
};
