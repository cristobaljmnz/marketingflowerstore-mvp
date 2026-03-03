import { NextRequest } from "next/server";
import { z } from "zod";
import { runPipeline, type ProgressEvent, type PipelineResult } from "@/lib/pipeline/generate";

// Allow long-running pipeline on Vercel
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const InputSchema = z.object({
  productImageUrl: z.string().url(),
  userMessage: z.string(),
  styleSelector: z.enum(["auto", "studio", "street"]),
});

function sseMessage(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = InputSchema.safeParse(body);

  if (!input.success) {
    return new Response(JSON.stringify({ error: input.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(sseMessage(data)));

      try {
        const result: PipelineResult = await runPipeline(
          input.data,
          (event: ProgressEvent) => send({ type: "progress", ...event })
        );

        send({ type: "result", data: result });
      } catch (err) {
        send({ type: "error", error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
