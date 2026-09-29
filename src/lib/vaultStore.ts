/**
 * Per-user Vault storage (browser).
 * Content is scoped to the signed-in user id.
 */

export type VaultFileKind = "pdf" | "doc" | "text" | "markdown" | "image" | "other";

export interface VaultFile {
  id: string;
  userId: string;
  name: string;
  kind: VaultFileKind;
  mimeType: string;
  sizeBytes: number;
  addedAt: string;
  /** Plain text for search / agents (when extractable) */
  textContent?: string;
  /** Small data URL for image preview only */
  previewDataUrl?: string;
}

const KEY = "nexa_vault_v1";
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB per file
const MAX_FILES = 80;

function readAll(): VaultFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VaultFile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(files: VaultFile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(files.slice(0, MAX_FILES)));
}

function uid() {
  return `vf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function detectKind(name: string, mime: string): VaultFileKind {
  const n = name.toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (
    m.includes("word") ||
    n.endsWith(".doc") ||
    n.endsWith(".docx")
  )
    return "doc";
  if (n.endsWith(".md") || n.endsWith(".markdown") || m.includes("markdown")) return "markdown";
  if (m.startsWith("text/") || n.endsWith(".txt") || n.endsWith(".csv")) return "text";
  return "other";
}

export function kindLabel(kind: VaultFileKind): string {
  const map: Record<VaultFileKind, string> = {
    pdf: "PDF",
    doc: "Document",
    text: "Text",
    markdown: "Markdown",
    image: "Image",
    other: "File",
  };
  return map[kind];
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAdded(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function listVaultFiles(userId: string): VaultFile[] {
  if (!userId) return [];
  return readAll()
    .filter((f) => f.userId === userId)
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}

export function totalVaultBytes(userId: string): number {
  return listVaultFiles(userId).reduce((sum, f) => sum + (f.sizeBytes || 0), 0);
}

export function getVaultFile(userId: string, id: string): VaultFile | null {
  return listVaultFiles(userId).find((f) => f.id === id) || null;
}

export function searchVaultFiles(userId: string, query: string): VaultFile[] {
  const q = query.trim().toLowerCase();
  const all = listVaultFiles(userId);
  if (!q) return all;
  return all.filter((f) => {
    const hay = `${f.name} ${f.textContent || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function removeVaultFile(userId: string, id: string): boolean {
  const next = readAll().filter((f) => !(f.userId === userId && f.id === id));
  writeAll(next);
  return true;
}

export async function addVaultFile(
  userId: string,
  file: File
): Promise<{ ok: true; file: VaultFile } | { ok: false; message: string }> {
  if (!userId) return { ok: false, message: "Please sign in first." };
  if (!file || !file.name) return { ok: false, message: "Choose a file to add." };
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      message: "This file is too large. Please use a file under 4 MB.",
    };
  }

  const kind = detectKind(file.name, file.type);
  let textContent: string | undefined;
  let previewDataUrl: string | undefined;

  try {
    if (kind === "text" || kind === "markdown") {
      textContent = await file.text();
      if (textContent.length > 200_000) {
        textContent = textContent.slice(0, 200_000);
      }
    } else if (kind === "image") {
      previewDataUrl = await readAsDataUrl(file);
      textContent = file.name;
    } else {
      // PDF/DOC: store name only for search in this version
      textContent = file.name;
    }
  } catch {
    return {
      ok: false,
      message: "We couldn't process this file. Please try again.",
    };
  }

  const entry: VaultFile = {
    id: uid(),
    userId,
    name: file.name,
    kind,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    addedAt: new Date().toISOString(),
    textContent,
    previewDataUrl,
  };

  const all = readAll().filter((f) => f.userId === userId);
  if (all.length >= MAX_FILES) {
    return {
      ok: false,
      message: "Your Vault is full. Remove a file before adding more.",
    };
  }

  writeAll([entry, ...readAll()]);
  return { ok: true, file: entry };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Agent-facing: search names + text content */
export function vaultSearchForAgent(userId: string, query: string): string {
  const hits = searchVaultFiles(userId, query);
  if (!hits.length) return "No matching items in Vault.";
  return hits
    .slice(0, 12)
    .map(
      (f) =>
        `• ${f.name} (${kindLabel(f.kind)}, ${formatSize(f.sizeBytes)})` +
        (f.textContent && f.kind !== "image"
          ? `\n  ${f.textContent.slice(0, 280).replace(/\s+/g, " ")}`
          : "")
    )
    .join("\n");
}

export function vaultReadForAgent(userId: string, nameQuery: string): string {
  const hits = searchVaultFiles(userId, nameQuery);
  const f = hits[0];
  if (!f) return "No matching file found in Vault.";
  if (f.kind === "image") return `Image: ${f.name} (${formatSize(f.sizeBytes)})`;
  if (f.textContent && (f.kind === "text" || f.kind === "markdown")) {
    return `${f.name}\n\n${f.textContent.slice(0, 8000)}`;
  }
  return `${f.name} is stored in Vault. Full text isn't available for this file type yet.`;
}
