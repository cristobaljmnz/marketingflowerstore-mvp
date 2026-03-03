import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseStorage } from "@/lib/storage/supabase";

const QuerySchema = z.object({
  tag: z.enum(["studio", "street"]).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tag = searchParams.get("tag") ?? undefined;

  const query = QuerySchema.safeParse({ tag });
  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  try {
    const ads = await supabaseStorage.getHistoricalAds(query.data.tag);
    return NextResponse.json({ ads });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
