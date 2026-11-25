import { NextResponse } from "next/server";
import { composioApiKey, composioConfigured } from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keyKind(key: string): string {
  if (!key) return "missing";
  if (/^uak_/i.test(key)) return "user";
  if (/^org[_-]?/i.test(key)) return "organization";
  if (key.length < 16) return "too_short";
  return "project_or_unknown";
}

/** GET — connectivity probe (never returns the API key). */
export async function GET() {
  if (!composioConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      reachable: false,
      keyKind: "missing",
      message: "App connections aren’t configured on the server yet.",
    });
  }

  const key = composioApiKey();
  const kind = keyKind(key);

  try {
    const headersList: Record<string, string>[] = [{ "x-api-key": key }];
    if (kind === "organization") headersList.push({ "x-org-api-key": key });
    if (kind === "user") headersList.unshift({ "x-user-api-key": key });

    let lastStatus = 0;
    for (const h of headersList) {
      const res = await fetch(
        "https://backend.composio.dev/api/v3/toolkits?limit=1",
        {
          headers: { ...h, Accept: "application/json" },
          cache: "no-store",
        }
      );
      lastStatus = res.status;
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : [];

      if (res.ok) {
        return NextResponse.json({
          ok: true,
          configured: true,
          reachable: true,
          keyKind: kind,
          sampleCount: items.length,
          message: "App catalogue is reachable.",
        });
      }
    }

    if (lastStatus === 401 || lastStatus === 403) {
      return NextResponse.json({
        ok: false,
        configured: true,
        reachable: false,
        httpStatus: lastStatus,
        keyKind: kind,
        message:
          kind === "user"
            ? "A user key is set. Use a Project API key from Settings → Project Settings → API Keys."
            : "The server key was rejected. Use a Project API key (not a user key), paste without quotes, save for Production, and redeploy.",
      });
    }

    return NextResponse.json({
      ok: false,
      configured: true,
      reachable: false,
      httpStatus: lastStatus,
      keyKind: kind,
      message: "Could not reach the app catalogue right now.",
    });
  } catch {
    return NextResponse.json({
      ok: false,
      configured: true,
      reachable: false,
      keyKind: kind,
      message: "Could not reach the app catalogue right now.",
    });
  }
}
