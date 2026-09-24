"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  loadOperatorState,
  ensureDefaultAgents,
  updateAgent,
  deleteAgent,
} from "@/lib/operatorStore";
import { Agent } from "@/types";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPurpose, setEditPurpose] = useState("");

  const refresh = () => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace(s.user ? "/onboarding" : "/signup");
      return;
    }
    setAgents(ensureDefaultAgents(s.user.id));
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
  }, [router]);

  const startEdit = (a: Agent) => {
    setEditing(a.id);
    setEditName(a.name);
    setEditPurpose(a.purpose);
  };

  const saveEdit = () => {
    if (!editing) return;
    updateAgent(editing, {
      name: editName.trim() || "Untitled agent",
      purpose: editPurpose.trim(),
      isTemplate: false,
    });
    setEditing(null);
    refresh();
  };

  const remove = (id: string) => {
    if (!confirm("Delete this agent?")) return;
    deleteAgent(id);
    refresh();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
            <p className="text-sm text-muted mt-1">
              Configure agents, then run work as Missions.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Create agent
          </Link>
        </div>

        {!loaded ? (
          <div className="space-y-3">
            <div className="skeleton h-28" />
            <div className="skeleton h-28" />
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            No agents yet. Create one to define a reusable objective.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {agents.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm"
              >
                {editing === a.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <textarea
                      value={editPurpose}
                      onChange={(e) => setEditPurpose(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{a.name}</div>
                      {a.isTemplate && (
                        <span className="text-[11px] text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                          Template
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted leading-relaxed">{a.purpose}</p>
                    <p className="text-[11px] text-muted">
                      Tools: {a.tools?.length ? a.tools.join(", ") : "none"}
                    </p>
                    <p className="text-[11px] text-muted">
                      {a.recentActivity || "Idle"}
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => startEdit(a)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(a.id)}
                        className="text-xs text-muted hover:text-red-600"
                      >
                        Delete
                      </button>
                      <Link
                        href="/missions"
                        className="text-xs text-muted hover:text-foreground ml-auto"
                      >
                        Run via Missions →
                      </Link>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
