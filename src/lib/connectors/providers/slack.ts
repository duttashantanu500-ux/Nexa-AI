/**
 * Slack provider — real API only. Friendly messages for callers.
 */

import { notConfigured, type ProviderResult } from "./types";

const API = "https://slack.com/api";

function friendlySlackError(code?: string, status?: number): string {
  switch (code) {
    case "invalid_auth":
    case "token_revoked":
    case "not_authed":
      return "Your Slack connection needs to be refreshed.";
    case "channel_not_found":
    case "not_in_channel":
      return "That Slack channel isn't available.";
    case "is_archived":
      return "That channel is archived.";
    case "msg_too_long":
      return "That message is too long for Slack.";
    case "rate_limited":
      return "Slack is temporarily limiting requests. Please try again shortly.";
    case "missing_scope":
      return "This action isn't currently allowed for your Slack connection.";
    default:
      if (status === 401) return "Your Slack connection needs to be refreshed.";
      if (status === 429) return "Slack is temporarily limiting requests. Please try again shortly.";
      return "Slack couldn't complete this request. Please try again.";
  }
}

export async function slackVerifyToken(accessToken: string): Promise<ProviderResult> {
  if (!accessToken) return notConfigured("Slack", "auth.test");
  const res = await fetch(`${API}/auth.test`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message: friendlySlackError(data.error, res.status),
      error: { category: "auth", providerMessage: data.error },
    };
  }
  return {
    ok: true,
    message: "Connected",
    data: { team: data.team, user: data.user, teamId: data.team_id },
  };
}

export async function slackPostMessage(params: {
  accessToken?: string;
  channel: string;
  text: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Slack", "postMessage");
  const channel = (params.channel || "").trim();
  const text = (params.text || "").trim();
  if (!channel) {
    return { ok: false, message: "Please choose a Slack channel.", error: { category: "validation" } };
  }
  if (!text) {
    return { ok: false, message: "Please enter a message.", error: { category: "validation" } };
  }

  // Resolve #name → id when needed
  let channelId = channel.replace(/^#/, "");
  if (!channelId.startsWith("C") && !channelId.startsWith("G") && !channelId.startsWith("D")) {
    const listed = await slackListChannels({ accessToken: params.accessToken });
    if (listed.ok && listed.data && typeof listed.data === "object") {
      const channels = (listed.data as { channels?: { id: string; name: string }[] }).channels || [];
      const match = channels.find(
        (c) => c.name.toLowerCase() === channelId.toLowerCase()
      );
      if (match) channelId = match.id;
    }
  }

  const res = await fetch(`${API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: channelId, text }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message: friendlySlackError(data.error, res.status),
      data: { ok: data.ok, error: data.error },
      error: {
        category:
          res.status === 401 || data.error === "invalid_auth" ? "auth" : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.error || res.statusText,
      },
    };
  }

  const label = channel.startsWith("#") ? channel : `#${channel.replace(/^#/, "")}`;
  return {
    ok: true,
    message: `Message sent to ${label}`,
    data: { channel: data.channel, ts: data.ts },
  };
}

export async function slackListChannels(params: {
  accessToken?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Slack", "listChannels");

  const res = await fetch(
    `${API}/conversations.list?limit=100&exclude_archived=true&types=public_channel,private_channel`,
    { headers: { Authorization: `Bearer ${params.accessToken}` } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message: friendlySlackError(data.error, res.status),
      data,
      error: {
        category: res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.error || res.statusText,
      },
    };
  }

  const channels = (data.channels || []).map(
    (c: { id?: string; name?: string }) => ({
      id: c.id || "",
      name: c.name || "",
    })
  ).filter((c: { id: string; name: string }) => c.id && c.name);

  const names = channels.map((c: { name: string }) => c.name);
  return {
    ok: true,
    message:
      channels.length === 0
        ? "No channels found."
        : `Found ${channels.length} channel${channels.length === 1 ? "" : "s"}`,
    data: { channels, names },
  };
}
