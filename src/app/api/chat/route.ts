import { NextRequest, NextResponse } from "next/server";
import { generateNexaResponse } from "@/lib/ai";

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
      requestId,
    } = body;

    if (!workspace || !userType) {
      return NextResponse.json(
        { success: false, error: "Missing required fields", content: "" },
        { status: 400 }
      );
    }

    // Only current conversation messages should be sent by the client
    const result = await generateNexaResponse({
      workspace,
      userType,
      businessContext: businessContext || null,
      memories: memories || [],
      recentMessages: recentMessages || [],
      userName,
      websiteContent,
      imageDataUrl,
      requestId,
    });

    return NextResponse.json({
      success: result.success,
      content: result.content,
      provider: result.provider,
      model: result.model,
      requestId: result.requestId || requestId,
      error: result.error,
    });
  } catch (err: any) {
    console.error("[Nexa Chat API] Error:", err);
    return NextResponse.json(
      {
        success: false,
        content: "",
        error: "generation_failed",
      },
      { status: 500 }
    );
  }
}
