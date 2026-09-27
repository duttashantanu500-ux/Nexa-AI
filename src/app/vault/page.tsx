"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  addVaultFile,
  formatAdded,
  formatSize,
  getVaultFile,
  kindLabel,
  listVaultFiles,
  removeVaultFile,
  searchVaultFiles,
  type VaultFile,
} from "@/lib/vaultStore";

export default function VaultPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState("");
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback((uid: string) => {
    setFiles(listVaultFiles(uid));
  }, []);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setUserId(s.user.id);
    refresh(s.user.id);
  }, [router, refresh]);

  const visible = useMemo(() => {
    if (!userId) return [];
    return searchVaultFiles(userId, query);
  }, [userId, query, files]);

  const selected = selectedId && userId ? getVaultFile(userId, selectedId) : null;

  const onAdd = async (list: FileList | null) => {
    if (!list?.length || !userId) return;
    setBusy(true);
    setMessage("");
    let okCount = 0;
    let lastError = "";
    for (const file of Array.from(list)) {
      const r = await addVaultFile(userId, file);
      if (r.ok) okCount += 1;
      else lastError = r.message;
    }
    refresh(userId);
    if (okCount) setMessage(okCount === 1 ? "File added." : `${okCount} files added.`);
    if (lastError) setMessage(lastError);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onRemove = (id: string) => {
    if (!userId) return;
    if (!confirm("Remove this file from your Vault?")) return;
    removeVaultFile(userId, id);
    if (selectedId === id) setSelectedId(null);
    refresh(userId);
    setMessage("File removed.");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Vault</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Your private knowledge, ready for your agents.
            </p>
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.gif,.webp,text/plain,application/pdf,image/*"
              className="hidden"
              onChange={(e) => void onAdd(e.target.files)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Adding…" : "+ Add files"}
            </button>
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your Vault"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        {message && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {message}
          </div>
        )}

        {selected && (
          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{selected.name}</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {kindLabel(selected.kind)} · {formatSize(selected.sizeBytes)} · Added{" "}
                  {formatAdded(selected.addedAt)}
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>
            {selected.previewDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.previewDataUrl}
                alt={selected.name}
                className="max-h-64 rounded-lg border border-zinc-100 object-contain dark:border-zinc-800"
              />
            )}
            {selected.textContent &&
              (selected.kind === "text" || selected.kind === "markdown") && (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                  {selected.textContent.slice(0, 12000)}
                </pre>
              )}
            {(selected.kind === "pdf" || selected.kind === "doc") && (
              <p className="text-sm text-zinc-500">
                This file is saved in your Vault. Preview for this type is limited on this device.
              </p>
            )}
            <button
              type="button"
              onClick={() => onRemove(selected.id)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600"
            >
              Remove
            </button>
          </section>
        )}

        <section className="space-y-2">
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
              <p className="text-sm text-zinc-500">
                {query.trim()
                  ? "We couldn't find anything matching your search."
                  : "No files yet. Add notes, documents, or images your agents can use."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {kindLabel(f.kind).slice(0, 3)}
                  </div>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedId(f.id)}
                  >
                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {f.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {kindLabel(f.kind)} · {formatSize(f.sizeBytes)} · Added{" "}
                      {formatAdded(f.addedAt)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(f.id)}
                    className="shrink-0 text-xs text-zinc-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
