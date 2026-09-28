import { NextRequest, NextResponse } from "next/server";
import { resolveIdeogramToken } from "@/lib/connectors/ideogramAuth";
import { ideogramGenerateImage } from "@/lib/connectors/providers/ideogram";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const actionId = String(body.actionId || "").trim();
    const input = (body.input || {}) as Record<string, string>;

    if (!userId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }

    const resolved = await resolveIdeogramToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Connect your Ideogram account under Connections first.",
        error: { category: "not_configured" },
      });
    }

    if (actionId === "ideogram.generate_image") {
      const seedRaw = input.seed?.trim();
      const seed = seedRaw ? parseInt(seedRaw, 10) : undefined;
      const numRaw = input.num_images || input.numImages;
      const numImages = numRaw ? parseInt(String(numRaw), 10) : 1;

      const result = await ideogramGenerateImage({
        apiKey: resolved.token,
        prompt: input.prompt || "",
        aspectRatio: input.aspect_ratio || input.aspectRatio || "",
        renderingSpeed: input.rendering_speed || input.renderingSpeed || input.quality || "",
        numImages: Number.isFinite(numImages) ? numImages : 1,
        negativePrompt: input.negative_prompt || input.negativePrompt || "",
        seed: Number.isFinite(seed as number) ? seed : undefined,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({
      ok: false,
      message: "This action is not available.",
      error: { category: "validation" },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
