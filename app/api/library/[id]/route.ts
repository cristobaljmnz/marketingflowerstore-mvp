import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseStorage } from "@/lib/storage/supabase";

const PatchSchema = z.object({
  tag: z.enum(["studio", "street"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await supabaseStorage.updateHistoricalAdTag(id, parsed.data.tag);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
