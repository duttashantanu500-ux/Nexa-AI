/**
 * Notion provider — real API only. Never fabricates success.
 */

import { notConfigured, type ProviderResult } from "./types";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": VERSION,
  };
}

export async function notionVerifyToken(accessToken: string): Promise<ProviderResult> {
  const res = await fetch(`${API}/users/me`, {
    headers: headers(accessToken),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message: data.message || `Notion verify failed (${res.status})`,
      data,
      error: {
        category: res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.message || res.statusText,
      },
    };
  }
  return {
    ok: true,
    message: "Notion connection verified",
    data: {
      id: data.id,
      name: data.name || data.bot?.owner?.user?.name,
      type: data.type,
    },
  };
}

export async function notionCreatePage(params: {
  accessToken?: string;
  parentId: string;
  title: string;
  content?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Notion", "createPage");
  if (!params.parentId?.trim()) {
    return {
      ok: false,
      message: "Parent page ID is required",
      error: { category: "validation" },
    };
  }

  const parentId = params.parentId.replace(/-/g, "");
  // Notion accepts UUID with or without dashes in some contexts; send standard form
  const formatted =
    parentId.length === 32
      ? `${parentId.slice(0, 8)}-${parentId.slice(8, 12)}-${parentId.slice(12, 16)}-${parentId.slice(16, 20)}-${parentId.slice(20)}`
      : params.parentId;

  const body: Record<string, unknown> = {
    parent: { page_id: formatted },
    properties: {
      title: {
        title: [{ text: { content: (params.title || "Untitled").slice(0, 200) } }],
      },
    },
  };

  if (params.content?.trim()) {
    body.children = [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: params.content.slice(0, 2000) },
            },
          ],
        },
      },
    ];
  }

  const res = await fetch(`${API}/pages`, {
    method: "POST",
    headers: headers(params.accessToken),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message: data.message || `Notion createPage failed (${res.status})`,
      data,
      error: {
        category:
          res.status === 401
            ? "auth"
            : res.status === 400
              ? "validation"
              : res.status === 429
                ? "rate_limit"
                : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.message || res.statusText,
      },
    };
  }

  return {
    ok: true,
    message: `Created page ${data.id || ""}`,
    data: { id: data.id, url: data.url },
  };
}

export async function notionAppendBlocks(params: {
  accessToken?: string;
  pageId: string;
  content: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Notion", "appendBlocks");
  if (!params.pageId?.trim() || !params.content?.trim()) {
    return {
      ok: false,
      message: "pageId and content are required",
      error: { category: "validation" },
    };
  }

  const res = await fetch(`${API}/blocks/${params.pageId}/children`, {
    method: "PATCH",
    headers: headers(params.accessToken),
    body: JSON.stringify({
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: params.content.slice(0, 2000) },
              },
            ],
          },
        },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message: data.message || `Notion append failed (${res.status})`,
      data,
      error: {
        category: res.status === 401 ? "auth" : res.status === 429 ? "rate_limit" : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.message || res.statusText,
      },
    };
  }

  return {
    ok: true,
    message: "Content appended",
    data: { results: data.results?.length ?? 0 },
  };
}

export async function notionSearch(params: {
  accessToken?: string;
  query?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Notion", "search");

  const res = await fetch(`${API}/search`, {
    method: "POST",
    headers: headers(params.accessToken),
    body: JSON.stringify({
      query: params.query || "",
      page_size: 10,
      filter: { property: "object", value: "page" },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message: data.message || `Notion search failed (${res.status})`,
      data,
      error: {
        category: res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.message || res.statusText,
      },
    };
  }

  const pages = (data.results || []).map((r: {
    id: string;
    url?: string;
    properties?: Record<string, { title?: { plain_text?: string }[] }>;
  }) => {
    const titleProp = r.properties?.title || r.properties?.Name;
    const title =
      titleProp?.title?.map((t) => t.plain_text || "").join("") || r.id;
    return { id: r.id, url: r.url, title };
  });

  return {
    ok: true,
    message: `Found ${pages.length} page(s)`,
    data: { pages, count: pages.length },
  };
}
