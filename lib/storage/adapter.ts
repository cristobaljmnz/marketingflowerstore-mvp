import type { HistoricalAd } from "../schema/historical-ad";
import type { GeneratedCampaign } from "../schema/generated-campaign";

export interface StorageAdapter {
  // Image storage
  uploadImage(
    bucket: string,
    file: File | Buffer,
    filename: string
  ): Promise<string>;

  // Historical ads
  saveHistoricalAd(ad: HistoricalAd): Promise<void>;
  getHistoricalAds(tag?: "studio" | "street"): Promise<HistoricalAd[]>;
  updateHistoricalAdTag(id: string, tag: "studio" | "street"): Promise<void>;
  deleteHistoricalAd(id: string): Promise<void>;

  // Generated campaigns
  saveGeneratedCampaign(campaign: GeneratedCampaign): Promise<void>;
  getGeneratedCampaigns(filters?: {
    style?: "studio" | "street";
    intent?: "promo" | "emotional";
  }): Promise<GeneratedCampaign[]>;
  deleteGeneratedCampaign(id: string): Promise<void>;
}
