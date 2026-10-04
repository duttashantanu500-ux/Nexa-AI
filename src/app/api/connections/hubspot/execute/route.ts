import { NextRequest, NextResponse } from "next/server";
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
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const actionId = String(body.actionId || "").trim();
    const input = (body.input || {}) as Record<string, string>;

    if (!userId || !actionId) {
      return NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 400 }
      );
    }

    const resolved = await resolveHubspotToken(userId);
    if (!resolved?.token) {
      return NextResponse.json({
        ok: false,
        message: "Connect your HubSpot account under Connections first.",
      });
    }

    const token = resolved.token;
    let result;

    switch (actionId) {
      // Contacts
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

      // Companies
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

      // Deals
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
