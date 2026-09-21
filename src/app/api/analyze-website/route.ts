import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "NexaBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status}`, summary: null },
        { status: 200 }
      );
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const descMatch =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i
      );

    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length > 3000) text = text.slice(0, 3000);

    const title = (titleMatch?.[1] || "").trim();
    const description = (descMatch?.[1] || "").trim();

    const summaryParts = [];
    if (title) summaryParts.push(`Site title: ${title}`);
    if (description) summaryParts.push(`Description: ${description}`);
    if (text) summaryParts.push(`Page signals: ${text.slice(0, 600)}`);

    const summary =
      summaryParts.join(". ").slice(0, 900) ||
      "Website was reachable but little readable content was found.";

    return NextResponse.json({
      url: parsed.toString(),
      summary,
      title: title || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Failed",
        summary: null,
      },
      { status: 200 }
    );
  }
}
