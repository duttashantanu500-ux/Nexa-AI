import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCheckoutSession, isDodoConfigured } from "@/lib/billing";
import { safeReturnOrigin } from "@/lib/apiAuth";

export const runtime = "nodejs";

function userClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!isDodoConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          message: "Billing is not available right now. Please try again later.",
        },
        { status: 503 }
      );
    }

    const sb = userClient(req);
    if (!sb) {
      return NextResponse.json(
        { ok: false, message: "Please sign in to upgrade." },
        { status: 401 }
      );
    }

    const { data: authData, error: authErr } = await sb.auth.getUser();
    if (authErr || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in to upgrade." },
        { status: 401 }
      );
    }

    const user = authData.user;
    const body = await req.json().catch(() => ({}));
    const origin = safeReturnOrigin(body.returnOrigin, req);
    const returnUrl = `${origin}/settings?billing=success`;

    const result = await createCheckoutSession({
      userId: user.id,
      email: user.email || "",
      name:
        (user.user_metadata?.name as string) ||
        user.email?.split("@")[0] ||
        "Nexa user",
      returnUrl,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl });
  } catch (e) {
    console.error("billing/checkout", e);
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
