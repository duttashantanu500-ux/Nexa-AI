import { NextResponse } from "next/server";
import { callNexaIntelligence } from "@/lib/ai";
import type { AIRequest } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AIRequest;
    const content = await callNexaIntelligence(body);
    return NextResponse.json({ content });
  } catch (error) {
    console.error("Nexa Intelligence API error:", error);
    return NextResponse.json({ error: "Unable to generate a response" }, { status: 500 });
  }
}