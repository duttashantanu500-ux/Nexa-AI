import { NextResponse } from "next/server";
import {
  checkTokenStorageHealth,
  hasServiceRoleKey,
} from "@/lib/connectors/tokenStore";

/**
 * Diagnostics for durable connector storage.
 * Safe to call from the browser — no secrets returned.
 */
export async function GET() {
  const health = await checkTokenStorageHealth();
  const serviceRole = hasServiceRoleKey();
  const detail =
    !health.ok && health.detail
      ? String(health.detail).slice(0, 200)
      : undefined;

  if (health.ok && health.mode === "supabase") {
    return NextResponse.json({
      ok: true,
      message: serviceRole
        ? "Connection storage is ready."
        : "Connection storage works, but add SUPABASE_SERVICE_ROLE_KEY in Vercel for reliable saves.",
      serviceRole,
    });
  }

  if (health.ok && health.mode === "memory") {
    return NextResponse.json({
      ok: false,
      message:
        "Database is not set up. Connections will not stay after you leave the site. Add Supabase keys and create the connections table.",
      serviceRole,
    });
  }

  const reason = !health.ok ? health.reason : "unknown";
  let message =
    "Connection storage is not ready. Connections will not stay after you leave the site.";

  if (reason === "missing_table") {
    message =
      "The connections table is missing in Supabase. Open Supabase → SQL Editor and run the create table script for nexa_oauth_tokens.";
  } else if (reason === "rls_or_permission") {
    message =
      "The database blocked connection storage. Confirm SUPABASE_SERVICE_ROLE_KEY is the service_role key (not the anon key), then redeploy.";
  } else if (reason === "no_supabase") {
    message =
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.";
  } else if (reason === "bad_config") {
    message =
      "Supabase URL or key looks wrong. In Vercel, check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY match the same Supabase project.";
  }

  return NextResponse.json({
    ok: false,
    reason,
    message,
    serviceRole,
    detail,
  });
}
