import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public build fingerprint for DeployRefresh.
 * Changes on every Vercel production deploy.
 */
export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "dev";

  return NextResponse.json(
    { ok: true, buildId },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
