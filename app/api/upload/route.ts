import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabaseStorage } from "@/lib/storage/supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, and WEBP files are allowed" },
      { status: 400 }
    );
  }

  try {
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const filename = `${uuidv4()}.${ext}`;
    const imageUrl = await supabaseStorage.uploadImage(
      "product-uploads",
      file,
      filename
    );
    return NextResponse.json({ imageUrl });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
