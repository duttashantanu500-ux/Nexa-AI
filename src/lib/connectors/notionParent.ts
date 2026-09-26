/** Extract Notion page id from a full URL or raw id. */

export function extractNotionPageId(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  // Full URL: .../Title-32hex or .../32hex
  const fromUrl = raw.match(
    /([0-9a-fA-F]{32})|([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/
  );
  if (fromUrl) {
    return fromUrl[0].replace(/-/g, "");
  }

  // Already an id-like string
  const compact = raw.replace(/-/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(compact)) return compact;

  return null;
}

export function formatNotionPageId(id: string): string {
  const c = id.replace(/-/g, "");
  if (c.length !== 32) return id;
  return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;
}
