export type ToolPermission = "read" | "write" | "destructive";

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermission;
  requiresAuth: boolean;
  available: boolean;
}

export interface ToolResult {
  ok: boolean;
  tool: string;
  data?: unknown;
  error?: string;
  sources?: { title?: string; url: string }[];
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface PageExtract {
  url: string;
  title: string;
  text: string;
}

export interface ProspectRow {
  company: string;
  website: string;
  reason: string;
  evidence: string;
  source: string;
}
