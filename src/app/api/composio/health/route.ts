import { NextResponse } from "next/server";
import { composioApiKey, composioConfigured } from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — connectivity probe (never returns the API key). */
export async function GET() {
  if (!composioConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      reachable: false,
      message: "App connections aren’t configured on the server yet.",
    });
  }

  const key = composioApiKey();
  try {
    const res = await fetch(
      "https://backend.composio.dev/api/v3/toolkits?limit=1",
      {
        headers: { "x-api-key": key, Accept: "application/json" },
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: false,
        configured: true,
        reachable: false,
        httpStatus: res.status,
        message:
          "The server key was rejected. Create a new project key in your app connections dashboard and update it on Vercel (Production), then redeploy.",
      });
    }

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        configured: true,
        reachable: false,
        httpStatus: res.status,
        message: "Could not reach the app catalogue right now.",
      });
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      reachable: true,
      sampleCount: items.length,
      message: "App catalogue is reachable.",
    });
  } catch {
    return NextResponse.json({
      ok: false,
      configured: true,
      reachable: false,
      message: "Could not reach the app catalogue right now.",
    });
  }
}
