"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import {
  RobotAvatar,
  RobotAvatarPicker,
  resolveAgentAvatar,
  saveAgentAvatar,
  type RobotAvatarId,
} from "@/components/robots/RobotAvatar";
import {
  loadOperatorState,
  saveOperatorState,
  deleteAgent,
  updateAgent,
} from "@/lib/operatorStore";
import {
  fetchServerAgents,
  deleteServerAgent,
  patchServerAgent,
} from "@/lib/serverAgentClient";
import { listDueAgents } from "@/lib/clientScheduler";
import { statusBadgeClass } from "@/lib/runLifecycle";
import type { Agent } from "@/types";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState<RobotAvatarId>("cobalt");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [avatarTick, setAvatarTick] = useState(0);

  const refresh = async () => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    const uid = s.user?.id || "";
    let local = (s.agents || []).filter((a) => String(a.status) !== "archived");
    if (uid) {
      const matched = local.filter((a) => !a.userId || a.userId === uid);
      if (matched.length > 0) local = matched;
    }
    setAgents(local);
    setDueCount(listDueAgents().length);

    try {
      const remote = await fetchServerAgents();
      if (!remote.ok) return;
      const byId = new Map<string, Agent>();
      for (const a of local) byId.set(a.id, a);
      for (const r of remote.agents || []) {
        if (!r?.id) continue;
        const prev = byId.get(r.id);
        byId.set(r.id, {
          ...(prev || ({} as Agent)),
          id: r.id,
          userId: uid || prev?.userId || "",
          name: r.name || prev?.name || "AI Employee",
          description: r.description || prev?.description || "",
          purpose: r.purpose || r.description || prev?.purpose || "",
          status: r.status || prev?.status || "active",
          version: r.version || prev?.version || 1,
          steps: Array.isArray(r.steps) && r.steps.length ? r.steps : prev?.steps || [],
          schedule: prev?.schedule || { frequency: "once", enabled: false },
          tools: prev?.tools || [],
          permissions: prev?.permissions,
          lastRunAt: prev?.lastRunAt ?? null,
          lastRunStatus: prev?.lastRunStatus ?? null,
          createdAt: r.createdAt || prev?.createdAt || new Date().toISOString(),
          updatedAt: r.updatedAt || prev?.updatedAt || new Date().toISOString(),
        } as Agent);
      }
      const merged = Array.from(byId.values()).filter((a) => String(a.status) !== "archived");
      const st = loadOperatorState();
      st.agents = merged;
      saveOperatorState(st);
      setAgents(merged);
    } catch {
      /* keep local */
    }
  };

  useEffect(() => {
    void refresh();
  }, [router]);

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this AI employee? This cannot be undone.")) return;
    setBusyId(id);
    try {
      deleteAgent(id);
      await deleteServerAgent(id);
      await refresh();
    } finally {
      setBusyId("");
    }
  };

  const openEdit = (a: Agent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditId(a.id);
    setEditName(a.name || "");
    setEditAvatar(resolveAgentAvatar(a.id));
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editId) return;
    const name = editName.trim();
    if (!name) {
      setEditError("Name cannot be blank.");
      return;
    }
    if (name.length > 80) {
      setEditError("Keep the name under 80 characters.");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      updateAgent(editId, { name });
      saveAgentAvatar(editId, editAvatar);
      const remote = await patchServerAgent(editId, { name });
      if (!remote.ok && remote.message && !/not found|sign in/i.test(remote.message)) {
        setEditError(remote.message);
      }
      setAvatarTick((t) => t + 1);
      setEditId(null);
      await refresh();
    } catch {
      setEditError("Could not save. Please try again.");
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <PageHeader
          page="agents"
          title="Your AI Team"
          subtitle="Modular AI employees — each with a role, tools, and schedule."
          actions={
            <Link
              href="/agents/new"
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-600/20"
            >
              Hire AI Employee
            </Link>
          }
        />

        {dueCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {dueCount} schedule{dueCount === 1 ? "" : "s"} due while this app is open.
          </div>
        )}

        {agents.length === 0 ? (
          <div className="nexa-card border-dashed p-10 text-center">
            <RobotAvatar id="violet" size="lg" className="mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No AI employees yet.</p>
            <Link href="/agents/new" className="mt-3 inline-block text-sm text-indigo-600">
              Hire your first AI employee
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-1">
            {agents.map((a) => {
              const avatar = resolveAgentAvatar(a.id);
              void avatarTick;
              return (
                <li key={a.id}>
                  <div className="nexa-card flex items-center gap-3 px-4 py-3">
                    <Link href={`/agents/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <RobotAvatar id={avatar} size="md" title={a.name} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                          {a.name}
                        </div>
                        <p className="text-xs text-zinc-500">
                          {a.steps?.length || 0} steps · {a.schedule?.frequency || "once"}
                        </p>
                      </div>
                    </Link>
                    <span className={statusBadgeClass(String(a.status))}>
                      {String(a.status).replace(/_/g, " ")}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => openEdit(a, e)}
                      className="rounded-lg px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={(e) => void onDelete(a.id, e)}
                      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Edit employee
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Change the display name and robot avatar. Identity and workflows stay the same.
              </p>
              <label className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                autoFocus
              />
              <p className="mt-4 text-xs font-medium text-zinc-600 dark:text-zinc-300">Avatar</p>
              <div className="mt-2">
                <RobotAvatarPicker value={editAvatar} onChange={setEditAvatar} />
              </div>
              {editError && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400">{editError}</p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={editBusy}
                  onClick={() => setEditId(null)}
                  className="rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editBusy}
                  onClick={() => void saveEdit()}
                  className="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {editBusy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
