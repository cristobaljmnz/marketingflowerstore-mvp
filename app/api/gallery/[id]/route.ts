import { NextRequest, NextResponse } from "next/server";
import { supabaseStorage } from "@/lib/storage/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await supabaseStorage.deleteGeneratedCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
