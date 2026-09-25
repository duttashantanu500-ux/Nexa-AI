/**
 * Notion provider client.
 * Real API only with accessToken. Never fabricates page creation.
 */

import { notConfigured, type ProviderResult } from "./types";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

export async function notionCreatePage(params: {
  accessToken?: string;
  parentId: string;
  title: string;
  content?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("Notion", "createPage");

  const body: Record<string, unknown> = {
    parent: { page_id: params.parentId },
    properties: {
      title: {
        title: [{ text: { content: params.title } }],
      },
    },
  };

  if (params.content?.trim()) {
    body.children = [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: params.content.slice(0, 2000) } }],
        },
      },
    ];
  }

  const res = await fetch(`${API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      "Notion-Version": VERSION,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message: data.message || `Notion createPage failed (${res.status})`,
      data,
      error: {
        category: res.status === 401 ? "auth" : res.status === 400 ? "validation" : "server_error",
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
