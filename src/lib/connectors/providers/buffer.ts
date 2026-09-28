/**
 * Buffer provider — official GraphQL API only.
 * https://api.buffer.com
 */

import { notConfigured, type ProviderResult } from "./types";

const API = "https://api.buffer.com";

function friendlyBufferError(message?: string, status?: number): string {
  const m = (message || "").toLowerCase();
  if (status === 401 || m.includes("unauthorized") || m.includes("invalid token")) {
    return "Your Buffer connection needs to be refreshed.";
  }
  if (status === 429 || m.includes("rate")) {
    return "Buffer is temporarily limiting requests. Please try again shortly.";
  }
  if (m.includes("channel") && (m.includes("not found") || m.includes("unavailable"))) {
    return "That channel is no longer available.";
  }
  if (m.includes("permission") || m.includes("scope") || m.includes("forbidden")) {
    return "This action isn't currently allowed for your Buffer connection.";
  }
  return "Buffer couldn't complete this request. Please try again.";
}

async function gql(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; errors?: { message?: string }[]; status: number }> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  return {
    ok: res.ok && !json.errors?.length,
    data: json.data,
    errors: json.errors,
    status: res.status,
  };
}

export async function bufferVerifyToken(accessToken: string): Promise<ProviderResult> {
  if (!accessToken) return notConfigured("Buffer", "account");
  const result = await gql(
    accessToken,
    `query { account { id email organizations { id name } } }`
  );
  if (!result.ok || !result.data) {
    const msg = result.errors?.[0]?.message;
    return {
      ok: false,
      message: friendlyBufferError(msg, result.status),
      error: { category: "auth", providerMessage: msg },
    };
  }
  const account = (result.data as { account?: { email?: string; organizations?: { name?: string }[] } })
    .account;
  const orgName = account?.organizations?.[0]?.name;
  return {
    ok: true,
    message: "Connected",
    data: {
      email: account?.email,
      organizationName: orgName,
      organizations: account?.organizations || [],
    },
  };
}

export async function bufferListChannels(params: {
  accessToken?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Buffer", "channels");

  const accountRes = await gql(
    params.accessToken,
    `query { account { organizations { id name } } }`
  );
  if (!accountRes.ok || !accountRes.data) {
    const msg = accountRes.errors?.[0]?.message;
    return {
      ok: false,
      message: friendlyBufferError(msg, accountRes.status),
      error: {
        category: accountRes.status === 401 ? "auth" : "server_error",
        providerMessage: msg,
      },
    };
  }

  const orgs =
    (
      accountRes.data as {
        account?: { organizations?: { id: string; name?: string }[] };
      }
    ).account?.organizations || [];

  const channels: { id: string; name: string; service: string; organizationName?: string }[] = [];

  for (const org of orgs) {
    const chRes = await gql(
      params.accessToken,
      `query ($orgId: ID!) {
        channels(input: { organizationId: $orgId }) {
          id
          name
          service
        }
      }`,
      { orgId: org.id }
    );
    if (!chRes.ok) continue;
    const list =
      (chRes.data as { channels?: { id?: string; name?: string; service?: string }[] })?.channels ||
      [];
    for (const c of list) {
      if (c.id && c.name) {
        channels.push({
          id: c.id,
          name: c.name,
          service: c.service || "",
          organizationName: org.name,
        });
      }
    }
  }

  return {
    ok: true,
    message:
      channels.length === 0
        ? "No channels found in your Buffer account."
        : `Found ${channels.length} channel${channels.length === 1 ? "" : "s"}`,
    data: {
      channels,
      names: channels.map((c) => c.name),
    },
  };
}

async function resolveChannelId(
  accessToken: string,
  channelInput: string
): Promise<{ id: string; name: string } | null> {
  const input = channelInput.trim();
  if (!input) return null;
  const listed = await bufferListChannels({ accessToken });
  if (!listed.ok || !listed.data) return null;
  const channels =
    (listed.data as { channels?: { id: string; name: string }[] }).channels || [];
  const byId = channels.find((c) => c.id === input);
  if (byId) return byId;
  const byName = channels.find((c) => c.name.toLowerCase() === input.toLowerCase());
  return byName || null;
}

export async function bufferCreatePost(params: {
  accessToken?: string;
  channel: string;
  text: string;
  /** ISO 8601 UTC. If empty, add to next queue slot. */
  scheduledAt?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Buffer", "createPost");
  const text = (params.text || "").trim();
  const channel = (params.channel || "").trim();
  if (!channel) {
    return { ok: false, message: "Please choose a channel.", error: { category: "validation" } };
  }
  if (!text) {
    return { ok: false, message: "Please enter post text.", error: { category: "validation" } };
  }

  const resolved = await resolveChannelId(params.accessToken, channel);
  if (!resolved) {
    return {
      ok: false,
      message: "That channel is no longer available.",
      error: { category: "validation" },
    };
  }

  const dueAt = (params.scheduledAt || "").trim();
  const mode = dueAt ? "customScheduled" : "addToQueue";

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            dueAt
            status
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const input: Record<string, unknown> = {
    text,
    channelId: resolved.id,
    schedulingType: "automatic",
    mode,
  };
  if (dueAt) input.dueAt = dueAt;

  const result = await gql(params.accessToken, mutation, { input });
  if (!result.ok && result.status === 401) {
    return {
      ok: false,
      message: friendlyBufferError(undefined, 401),
      error: { category: "auth" },
    };
  }

  const createPost = (result.data as { createPost?: Record<string, unknown> })?.createPost;
  if (!createPost) {
    const msg = result.errors?.[0]?.message;
    return {
      ok: false,
      message: friendlyBufferError(msg, result.status),
      error: { category: "server_error", providerMessage: msg },
    };
  }

  if (typeof createPost.message === "string" && !createPost.post) {
    return {
      ok: false,
      message: friendlyBufferError(String(createPost.message)),
      error: { category: "server_error", providerMessage: String(createPost.message) },
    };
  }

  const post = createPost.post as
    | { id?: string; text?: string; dueAt?: string; status?: string }
    | undefined;
  if (!post?.id) {
    return {
      ok: false,
      message: "Buffer could not create the post.",
      error: { category: "server_error" },
    };
  }

  const status = String(post.status || (dueAt ? "scheduled" : "scheduled")).toLowerCase();
  let message = `Post added for ${resolved.name}`;
  if (status.includes("draft")) message = `Draft saved for ${resolved.name}`;
  else if (status.includes("sent") || status.includes("published")) {
    message = `Post published to ${resolved.name}`;
  } else if (post.dueAt) {
    message = `Post scheduled for ${resolved.name}`;
  }

  return {
    ok: true,
    message,
    data: {
      id: post.id,
      text: post.text,
      dueAt: post.dueAt,
      status: post.status || (dueAt ? "scheduled" : "queued"),
      channelName: resolved.name,
    },
  };
}

export async function bufferListPosts(params: {
  accessToken?: string;
  channel?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Buffer", "listPosts");

  const channelInput = (params.channel || "").trim();
  if (!channelInput) {
    return {
      ok: false,
      message: "Please choose a channel.",
      error: { category: "validation" },
    };
  }

  const resolved = await resolveChannelId(params.accessToken, channelInput);
  if (!resolved) {
    return {
      ok: false,
      message: "That channel is no longer available.",
      error: { category: "validation" },
    };
  }

  // Prefer a simple posts query; fall back to friendly error if schema differs
  const result = await gql(
    params.accessToken,
    `query ($channelId: ID!) {
      posts(input: { channelId: $channelId }, first: 20) {
        edges {
          node {
            id
            text
            status
            dueAt
          }
        }
      }
    }`,
    { channelId: resolved.id }
  );

  if (!result.ok) {
    // Some accounts may not expose posts the same way — report honestly
    const msg = result.errors?.[0]?.message;
    return {
      ok: false,
      message: friendlyBufferError(msg, result.status),
      error: {
        category: result.status === 401 ? "auth" : "server_error",
        providerMessage: msg,
      },
    };
  }

  const edges =
    (result.data as { posts?: { edges?: { node?: { id?: string; text?: string; status?: string; dueAt?: string } }[] } })
      ?.posts?.edges || [];
  const posts = edges
    .map((e) => e.node)
    .filter(Boolean)
    .map((n) => ({
      id: n!.id || "",
      text: (n!.text || "").slice(0, 120),
      status: n!.status || "",
      dueAt: n!.dueAt || null,
    }));

  return {
    ok: true,
    message:
      posts.length === 0
        ? `No recent posts for ${resolved.name}.`
        : `Found ${posts.length} post${posts.length === 1 ? "" : "s"} for ${resolved.name}`,
    data: { posts, channelName: resolved.name },
  };
}
