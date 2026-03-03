import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseStorage } from "@/lib/storage/supabase";

const QuerySchema = z.object({
  style: z.enum(["studio", "street"]).optional(),
  intent: z.enum(["promo", "emotional"]).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const style = searchParams.get("style") ?? undefined;
  const intent = searchParams.get("intent") ?? undefined;

  const query = QuerySchema.safeParse({ style, intent });
  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  try {
    const campaigns = await supabaseStorage.getGeneratedCampaigns(query.data);
    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
