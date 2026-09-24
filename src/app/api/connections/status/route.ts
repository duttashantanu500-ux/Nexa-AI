import { NextResponse } from "next/server";
import { getProviderStatuses } from "@/lib/connections/config";

export async function GET() {
  const providers = getProviderStatuses();
  return NextResponse.json({
    ok: true,
    builtinTools: [
      { name: "web_search", available: true, permission: "read" },
      { name: "web_page_reader", available: true, permission: "read" },
      { name: "structured_data", available: true, permission: "read" },
    ],
    providers,
  });
}
