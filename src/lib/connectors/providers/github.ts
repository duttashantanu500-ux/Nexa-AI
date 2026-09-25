/**
 * GitHub provider client.
 * Real API only with accessToken. Never fabricates issues.
 */

import { notConfigured, type ProviderResult } from "./types";

const API = "https://api.github.com";

export async function githubCreateIssue(params: {
  accessToken?: string;
  owner: string;
  repo: string;
  title: string;
  body?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("GitHub", "createIssue");

  const res = await fetch(
    `${API}/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/issues`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: params.title,
        body: params.body || "",
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message: data.message || `GitHub createIssue failed (${res.status})`,
      data,
      error: {
        category: res.status === 401 || res.status === 403 ? "auth" : "server_error",
        providerStatusCode: res.status,
        providerMessage: data.message || res.statusText,
      },
    };
  }

  return {
    ok: true,
    message: `Created issue #${data.number}`,
    data: { number: data.number, html_url: data.html_url },
  };
}

export async function githubListIssues(params: {
  accessToken?: string;
  owner: string;
  repo: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("GitHub", "listIssues");

  const res = await fetch(
    `${API}/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/issues?state=open&per_page=20`,
    {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  const data = await res.json().catch(() => ([]));
  if (!res.ok) {
    return {
      ok: false,
      message: (data as { message?: string }).message || `GitHub listIssues failed (${res.status})`,
      data,
      error: {
        category: res.status === 401 || res.status === 403 ? "auth" : "server_error",
        providerStatusCode: res.status,
        providerMessage: (data as { message?: string }).message || res.statusText,
      },
    };
  }

  const list = Array.isArray(data) ? data : [];
  return {
    ok: true,
    message: `Found ${list.length} open issues`,
    data: {
      issues: list.map((i: { number: number; title: string; html_url: string }) => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
      })),
    },
  };
}
