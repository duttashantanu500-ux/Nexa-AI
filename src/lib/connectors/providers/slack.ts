/**
 * Slack provider client.
 * Real API calls only when accessToken is present.
 * Without token → not_configured (never fake success).
 */

import { notConfigured, type ProviderResult } from "./types";

const API = "https://slack.com/api";

export async function slackPostMessage(params: {
  accessToken?: string;
  channel: string;
  text: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Slack", "postMessage");

  const res = await fetch(`${API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: params.channel,
      text: params.text,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message: data.error || `Slack postMessage failed (${res.status})`,
      data: { ok: data.ok, error: data.error },
      error: {
        category: res.status === 401 || data.error === "invalid_auth" ? "auth" : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.error || res.statusText,
      },
    };
  }

  return {
    ok: true,
    message: `Posted to ${params.channel}`,
    data: { channel: data.channel, ts: data.ts },
  };
}

export async function slackListChannels(params: {
  accessToken?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Slack", "listChannels");

  const res = await fetch(
    `${API}/conversations.list?limit=20&types=public_channel,private_channel`,
    {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message: data.error || `Slack listChannels failed (${res.status})`,
      data,
      error: {
        category: res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.error || res.statusText,
      },
    };
  }

  const names = (data.channels || []).map((c: { name?: string }) => c.name).filter(Boolean);
  return {
    ok: true,
    message: `Found ${names.length} channels`,
    data: { channels: names },
  };
}
