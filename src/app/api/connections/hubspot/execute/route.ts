import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import {
  hubspotListContacts,
  hubspotSearchContacts,
  hubspotGetContact,
  hubspotCreateContact,
  hubspotUpdateContact,
  hubspotListCompanies,
  hubspotSearchCompanies,
  hubspotGetCompany,
  hubspotCreateCompany,
  hubspotUpdateCompany,
  hubspotListDeals,
  hubspotSearchDeals,
  hubspotGetDeal,
  hubspotCreateDeal,
  hubspotUpdateDeal,
} from "@/lib/connectors/providers/hubspot";
import { resolveHubspotToken } from "@/lib/connectors/hubspotAuth";

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

    if (!actionId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }

    const resolved = await resolveHubspotToken(auth.userId);
    if (!resolved?.token) {
      return NextResponse.json({
        ok: false,
        message: "Connect your HubSpot account under Connections first.",
      });
    }

    const token = resolved.token;
    let result;

    switch (actionId) {
      case "hubspot.list_contacts":
        result = await hubspotListContacts({
          accessToken: token,
          limit: input.limit ? Number(input.limit) : undefined,
        });
        break;
      case "hubspot.search_contacts":
        result = await hubspotSearchContacts({
          accessToken: token,
          query: input.query || input.q || "",
          limit: input.limit ? Number(input.limit) : undefined,
        });
        break;
      case "hubspot.get_contact":
        result = await hubspotGetContact({
          accessToken: token,
          contactId: input.contactId || input.id || "",
        });
        break;
      case "hubspot.create_contact":
        result = await hubspotCreateContact({
          accessToken: token,
          email: input.email,
          firstname: input.firstname || input.firstName,
          lastname: input.lastname || input.lastName,
          phone: input.phone,
          company: input.company,
          jobtitle: input.jobtitle || input.jobTitle,
        });
        break;
      case "hubspot.update_contact":
        result = await hubspotUpdateContact({
          accessToken: token,
          contactId: input.contactId || input.id || "",
          email: input.email,
          firstname: input.firstname || input.firstName,
          lastname: input.lastname || input.lastName,
          phone: input.phone,
          company: input.company,
          jobtitle: input.jobtitle || input.jobTitle,
        });
        break;
      case "hubspot.list_companies":
        result = await hubspotListCompanies({
          accessToken: token,
          limit: input.limit ? Number(input.limit) : undefined,
        });
        break;
      case "hubspot.search_companies":
        result = await hubspotSearchCompanies({
          accessToken: token,
          query: input.query || input.q || "",
          limit: input.limit ? Number(input.limit) : undefined,
        });
        break;
      case "hubspot.get_company":
        result = await hubspotGetCompany({
          accessToken: token,
          companyId: input.companyId || input.id || "",
        });
        break;
      case "hubspot.create_company":
        result = await hubspotCreateCompany({
          accessToken: token,
          name: input.name,
          domain: input.domain,
          industry: input.industry,
          phone: input.phone,
          city: input.city,
          state: input.state,
          country: input.country,
        });
        break;
      case "hubspot.update_company":
        result = await hubspotUpdateCompany({
          accessToken: token,
          companyId: input.companyId || input.id || "",
          name: input.name,
          domain: input.domain,
          industry: input.industry,
          phone: input.phone,
          city: input.city,
          state: input.state,
          country: input.country,
        });
        break;
      case "hubspot.list_deals":
        result = await hubspotListDeals({
          accessToken: token,
          limit: input.limit ? Number(input.limit) : undefined,
        });
        break;
      case "hubspot.search_deals":
        result = await hubspotSearchDeals({
          accessToken: token,
          query: input.query || input.q || "",
          limit: input.limit ? Number(input.limit) : undefined,
        });
        break;
      case "hubspot.get_deal":
        result = await hubspotGetDeal({
          accessToken: token,
          dealId: input.dealId || input.id || "",
        });
        break;
      case "hubspot.create_deal":
        result = await hubspotCreateDeal({
          accessToken: token,
          dealname: input.dealname || input.name || input.dealName,
          amount: input.amount,
          dealstage: input.dealstage || input.stage || input.dealStage,
          pipeline: input.pipeline,
          closedate: input.closedate || input.closeDate,
        });
        break;
      case "hubspot.update_deal":
        result = await hubspotUpdateDeal({
          accessToken: token,
          dealId: input.dealId || input.id || "",
          dealname: input.dealname || input.name || input.dealName,
          amount: input.amount,
          dealstage: input.dealstage || input.stage || input.dealStage,
          pipeline: input.pipeline,
          closedate: input.closedate || input.closeDate,
        });
        break;
      default:
        return NextResponse.json({
          ok: false,
          message: "This HubSpot action is not available.",
        });
    }

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      data: result.data,
      error: result.error,
    });
  } catch (e) {
    console.error("[hubspot/execute]", e);
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
