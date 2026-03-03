import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { CampaignPlanSchema } from "@/lib/schema/campaign-plan";
import { GeneratedCampaignSchema } from "@/lib/schema/generated-campaign";
import { supabaseStorage } from "@/lib/storage/supabase";

const InputSchema = z.object({
  productImageUrl: z.string().url(),
  generatedImageUrls: z.array(z.string().url()),
  campaignPlan: CampaignPlanSchema,
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = InputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: input.error.flatten() }, { status: 400 });
  }

  const { productImageUrl, generatedImageUrls, campaignPlan } = input.data;

  try {
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

    return NextResponse.json({ savedId: campaign.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
