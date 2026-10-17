import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { resolveVapiToken } from "@/lib/connectors/vapiAuth";
import {
  vapiListAssistants,
  vapiListPhoneNumbers,
  vapiListCalls,
  vapiCreateOutboundCall,
} from "@/lib/connectors/providers/vapi";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const actionId = String((body as { actionId?: string }).actionId || "").trim();
    const input = ((body as { input?: Record<string, string> }).input || {}) as Record<
      string,
      string
    >;

    const resolved = await resolveVapiToken(auth.userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Connect your own Vapi account under Connections first.",
        error: { category: "not_configured" },
      });
    }

    if (actionId === "vapi.list_assistants") {
      return NextResponse.json(await vapiListAssistants(resolved.token));
    }
    if (actionId === "vapi.list_phone_numbers") {
      return NextResponse.json(await vapiListPhoneNumbers(resolved.token));
    }
    if (actionId === "vapi.list_calls") {
      const limit = parseInt(String(input.limit || "20"), 10);
      return NextResponse.json(
        await vapiListCalls(resolved.token, Number.isFinite(limit) ? limit : 20)
      );
    }
    if (actionId === "vapi.create_outbound_call") {
      return NextResponse.json(
        await vapiCreateOutboundCall({
          apiKey: resolved.token,
          assistantId: input.assistantId || "",
          phoneNumberId: input.phoneNumberId || "",
          customerNumber: input.customerNumber || "",
        })
      );
    }

    return NextResponse.json({
      ok: false,
      message: "This action is not available.",
      error: { category: "validation" },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
