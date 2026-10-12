import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, isDodoConfigured } from "@/lib/billing";
import { requireAuthUser, safeReturnOrigin } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const auth = await requireAuthUser(req);
    if ("error" in auth) {
      return NextResponse.json(
        { ok: false, message: "Please sign in to upgrade." },
        { status: 401 }
      );
    }

    const user = auth.user;
    const body = await req.json().catch(() => ({}));
    const origin = safeReturnOrigin(
      (body as { returnOrigin?: string }).returnOrigin,
      req
    );
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
