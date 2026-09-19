import { NextRequest, NextResponse } from "next/server";
import { callNexaIntelligence } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      workspace,
      userType,
      businessContext,
      memories,
      recentMessages,
      userName,
      websiteContent,
      imageDataUrl,
    } = body;

    if (!workspace || !userType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const response = await callNexaIntelligence({
      workspace,
      userType,
      businessContext: businessContext || null,
      memories: memories || [],
      recentMessages: recentMessages || [],
      userName,
      websiteContent,
      imageDataUrl,
    });

    return NextResponse.json({ content: response });
  } catch (err: any) {
    console.error("[Nexa Chat API] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate response" },
      { status: 500 }
    );
  }
}
