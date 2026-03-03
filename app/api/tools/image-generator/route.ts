import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { nanoBanana } from "@/lib/llm/nano-banana";
import { supabaseStorage } from "@/lib/storage/supabase";

const InputSchema = z.object({
  prompt: z.string(),
  style: z.enum(["studio", "street"]),
  productImageUrl: z.string().url(),
});

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
  return { buffer: Buffer.from(base64, "base64"), mimeType };
}

function mimeToExt(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = InputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: input.error.flatten() }, { status: 400 });
  }

  const { prompt, productImageUrl } = input.data;

  try {
    const { imageUrl: dataUrl } = await nanoBanana({
      prompt,
      referenceImageUrl: productImageUrl,
    });

    const { buffer, mimeType } = dataUrlToBuffer(dataUrl);
    const filename = `${uuidv4()}.${mimeToExt(mimeType)}`;
    const imageUrl = await supabaseStorage.uploadImage(
      "generated-campaigns",
      buffer,
      filename
    );

    return NextResponse.json({ imageUrl });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
