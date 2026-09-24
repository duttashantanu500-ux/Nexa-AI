import { NextRequest, NextResponse } from "next/server";
import { webSearch } from "@/lib/tools/webSearch";

/** Direct tool endpoint — returns real search results only */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body.query || "").trim();
    const maxResults = Math.min(Number(body.maxResults) || 10, 20);
    if (!query) {
      return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });
    }
    const result = await webSearch(query, maxResults);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, tool: "web_search", error: err?.message || "failed" },
      { status: 500 }
    );
  }
}
