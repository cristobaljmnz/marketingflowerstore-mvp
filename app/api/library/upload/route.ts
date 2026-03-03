import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { supabaseStorage } from "@/lib/storage/supabase";
import { HistoricalAdSchema } from "@/lib/schema/historical-ad";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MetaSchema = z.object({
  tag: z.enum(["studio", "street"]),
  title: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  const metaRaw = formData.get("meta");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, and WEBP files are allowed" },
      { status: 400 }
    );
  }

  const meta = MetaSchema.safeParse(
    metaRaw ? JSON.parse(String(metaRaw)) : {}
  );
  if (!meta.success) {
    return NextResponse.json({ error: meta.error.flatten() }, { status: 400 });
  }

  try {
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const filename = `${uuidv4()}.${ext}`;
    const imageUrl = await supabaseStorage.uploadImage(
      "historical-ads",
      file,
      filename
    );

    const ad = HistoricalAdSchema.parse({
      id: uuidv4(),
      imageUrl,
      tag: meta.data.tag,
      title: meta.data.title,
      description: meta.data.description,
      uploadedAt: new Date().toISOString(),
    });

    await supabaseStorage.saveHistoricalAd(ad);

    return NextResponse.json({ ad });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
