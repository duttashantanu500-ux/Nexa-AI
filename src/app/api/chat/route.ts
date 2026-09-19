import { NextResponse } from "next/server";
import { callNexaIntelligence, hasCloudProvider, NO_CLOUD_PROVIDER } from "@/lib/ai";
import type { AIRequest } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    if (!hasCloudProvider() && !process.env.OLLAMA_BASE_URL) {
      return NextResponse.json({ error: NO_CLOUD_PROVIDER }, { status: 503 });
    }
    const body = (await request.json()) as AIRequest;
    const content = await callNexaIntelligence(body);
    return NextResponse.json({ content });
  } catch (error) {
    console.error("Nexa Intelligence API error:", error);
    return NextResponse.json({ error: "Unable to generate a response" }, { status: 500 });
  }
}