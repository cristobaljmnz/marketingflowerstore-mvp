import { createClient } from "@supabase/supabase-js";
import { HistoricalAdSchema, type HistoricalAd } from "../schema/historical-ad";
import {
  GeneratedCampaignSchema,
  type GeneratedCampaign,
} from "../schema/generated-campaign";
import type { StorageAdapter } from "./adapter";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key);
}

function contentTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export const supabaseStorage: StorageAdapter = {
  async uploadImage(bucket, file, filename) {
    const supabase = getClient();
    const contentType =
      file instanceof File && file.type
        ? file.type
        : contentTypeFromFilename(filename);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, file, { contentType, upsert: true });

    if (error) throw new Error(`uploadImage failed: ${error.message}`);

    const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
    return data.publicUrl;
  },

  async saveHistoricalAd(ad) {
    const supabase = getClient();
    const { error } = await supabase.from("historical_ads").insert({
      id: ad.id,
      image_url: ad.imageUrl,
      tag: ad.tag,
      title: ad.title ?? null,
      description: ad.description ?? null,
      uploaded_at: ad.uploadedAt,
    });
    if (error) throw new Error(`saveHistoricalAd failed: ${error.message}`);
  },

  async getHistoricalAds(tag) {
    const supabase = getClient();
    let query = supabase
      .from("historical_ads")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (tag) query = query.eq("tag", tag);

    const { data, error } = await query;
    if (error) throw new Error(`getHistoricalAds failed: ${error.message}`);

    return (data ?? []).map((row) =>
      HistoricalAdSchema.parse({
        id: row.id,
        imageUrl: row.image_url,
        tag: row.tag,
        title: row.title ?? undefined,
        description: row.description ?? undefined,
        uploadedAt: row.uploaded_at,
      })
    );
  },

  async updateHistoricalAdTag(id, tag) {
    const supabase = getClient();
    const { error } = await supabase
      .from("historical_ads")
      .update({ tag })
      .eq("id", id);
    if (error)
      throw new Error(`updateHistoricalAdTag failed: ${error.message}`);
  },

  async saveGeneratedCampaign(campaign) {
    const supabase = getClient();
    const { error } = await supabase.from("generated_campaigns").insert({
      id: campaign.id,
      product_image_url: campaign.productImageUrl,
      generated_image_urls: campaign.generatedImageUrls,
      campaign_plan: campaign.campaignPlan,
      style: campaign.style,
      intent: campaign.intent,
      caption_options: campaign.captionOptions,
      hashtags: campaign.hashtags,
      reference_ids: campaign.referenceIds,
      created_at: campaign.createdAt,
    });
    if (error)
      throw new Error(`saveGeneratedCampaign failed: ${error.message}`);
  },

  async getGeneratedCampaigns(filters) {
    const supabase = getClient();
    let query = supabase
      .from("generated_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (filters?.style) query = query.eq("style", filters.style);
    if (filters?.intent) query = query.eq("intent", filters.intent);

    const { data, error } = await query;
    if (error)
      throw new Error(`getGeneratedCampaigns failed: ${error.message}`);

    return (data ?? []).map((row) =>
      GeneratedCampaignSchema.parse({
        id: row.id,
        productImageUrl: row.product_image_url,
        generatedImageUrls: row.generated_image_urls,
        campaignPlan: row.campaign_plan,
        style: row.style,
        intent: row.intent,
        captionOptions: row.caption_options,
        hashtags: row.hashtags,
        referenceIds: row.reference_ids,
        createdAt: row.created_at,
      })
    );
  },
};
