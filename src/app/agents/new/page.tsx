"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createAgent, loadOperatorState, saveOperatorState, stepId } from "@/lib/operatorStore";
import {
  draftScopeId,
  employeeScopeId,
  loadBuilderChat,
  migrateBuilderChat,
  saveBuilderChat,
  type BuilderLine,
} from "@/lib/agentBuilder/chatStore";
import {
  canCreateAgent,
  fetchBillingStatus,
  type ClientBillingState,
} from "@/lib/clientBilling";
import type { AgentProposal } from "@/lib/agentBuilder/types";
import { UpgradeLimitModal } from "@/components/UpgradeLimitModal";
import { LIMIT_MESSAGES } from "@/lib/plans";
import { fetchServerAgents, saveServerAgent } from "@/lib/serverAgentClient";
import {
  ROLE_TEMPLATES,
  getRoleTemplate,
  type RoleTemplate,
} from "@/lib/roleTemplates";
import {
  LiveAccountPicker,
  livePickToMessage,
  type LivePick,
} from "@/components/LiveAccountPicker";
import {
  injectNotionParentIntoSteps,
  resolveNotionParentForHire,
  setNotionParent,
} from "@/lib/notionParent";

type ChatLine = { role: "user" | "assistant"; content: string; thinking?: string[] };

export default function NewAgentPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="px-4 py-12 text-center text-sm text-zinc-500">Loading…</div>
        </AppShell>
      }
    >
      <NewAgentInner />
    </Suspense>
  );
}

function NewAgentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [requiredConnectors, setRequiredConnectors] = useState<
    { id: string; name: string; status: string }[]
  >([]);
  const [creating, setCreating] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [billing, setBilling] = useState<ClientBillingState | null>(null);
  const [pickedRole, setPickedRole] = useState<RoleTemplate | null>(null);
  const [chatReady, setChatReady] = useState(false);
  const [showDesk, setShowDesk] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<string>("");
  const roleAutoStarted = useRef(false);
  const hireHintStarted = useRef(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.id) {
      router.replace("/login");
      return;
    }
    if (!s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    const scope = draftScopeId(s.user.id);
    scopeRef.current = scope;
    const stored = loadBuilderChat(scope);
    if (stored.lines?.length) {
      setLines(
        stored.lines.map((l) => ({
          role: l.role,
          content: l.content,
          thinking: l.thinking,
        }))
      );
      if (stored.proposal) setProposal(stored.proposal as AgentProposal);
      setShowDesk(false);
    }
    setChatReady(true);
    void fetchBillingStatus().then(setBilling).catch(() => null);
  }, [router]);

  // Accept hire intent from Home WorkforceChat
  useEffect(() => {
    if (!chatReady || hireHintStarted.current) return;
    let hint = "";
    try {
      hint = sessionStorage.getItem("nexa_hire_hint") || "";
      if (hint) sessionStorage.removeItem("nexa_hire_hint");
    } catch {
      /* */
    }
    if (!hint.trim()) return;
    hireHintStarted.current = true;
    setShowDesk(false);
    const timer = setTimeout(() => {
      void sendMessage(hint.trim());
    }, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatReady]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, busy, proposal]);

  const persist = (next: ChatLine[], prop: AgentProposal | null) => {
    if (!scopeRef.current) return;
    const mapped: BuilderLine[] = next.map((l) => ({
      role: l.role,
      content: l.content,
      thinking: l.thinking,
    }));
    saveBuilderChat(scopeRef.current, mapped, prop);
  };

  const sendMessage = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setShowDesk(false);
    setError("");
    const nextLines: ChatLine[] = [...lines, { role: "user", content: msg }];
    setLines(nextLines);
    setInput("");
    setBusy(true);
    try {
      const s = loadOperatorState();
      const res = await fetch("/api/agent-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextLines.map((l) => ({ role: l.role, content: l.content })),
          userId: s.user?.id,
          mode: "create",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(data.message || "Could not process that. Try again.");
        setBusy(false);
        return;
      }
      const reply = String(data.message || data.reply || "");
      const thinking = Array.isArray(data.thinking) ? data.thinking : undefined;
      let prop = data.proposal || null;
      if (prop?.steps) {
        const resolved = await resolveNotionParentForHire(s.user?.id);
        if (resolved.parentId) {
          prop = {
            ...prop,
            steps: injectNotionParentIntoSteps(
              prop.steps,
              resolved.parentId,
              resolved.parentLabel
            ),
          };
        }
      }
      const withAssistant: ChatLine[] = [
        ...nextLines,
        { role: "assistant", content: reply || "Draft ready.", thinking },
      ];
      setLines(withAssistant);
      if (prop) setProposal(prop);
      if (Array.isArray(data.requiredConnectors)) setRequiredConnectors(data.requiredConnectors);
      persist(withAssistant, prop);
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  };

  const pickTemplate = (t: RoleTemplate) => {
    setPickedRole(t);
    void sendMessage(
      `Hire a ${t.name}. Role: ${t.role}. ${t.description} Constraints: ${t.constraints}`
    );
  };

  useEffect(() => {
    if (!chatReady || lines.length || roleAutoStarted.current) return;
    const roleId =
      searchParams.get("role") ||
      (() => {
        try {
          return sessionStorage.getItem("nexa_onboard_role") || "";
        } catch {
          return "";
        }
      })();
    if (!roleId) return;
    const t = getRoleTemplate(roleId);
    if (!t) return;
    roleAutoStarted.current = true;
    try {
      sessionStorage.removeItem("nexa_onboard_role");
    } catch {
      /* */
    }
    const timer = setTimeout(() => pickTemplate(t), 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatReady, lines.length, searchParams]);

  const confirmHire = async () => {
    if (!proposal || creating) return;
    setCreating(true);
    setError("");
    try {
      const s = loadOperatorState();
      if (!s.user?.id) {
        router.replace("/login");
        return;
      }
      const bill = billing || (await fetchBillingStatus());
      let agentCount = (s.agents || []).filter(
        (a) => String(a.status) !== "archived"
      ).length;
      try {
        const remote = await fetchServerAgents();
        if (remote.ok && Array.isArray(remote.agents)) {
          agentCount = Math.max(
            agentCount,
            remote.agents.filter(
              (a) => String(a.status || "active") !== "archived"
            ).length
          );
        }
      } catch {
        /* local count */
      }
      const check = canCreateAgent(agentCount, bill);
      if (!check.ok) {
        setError(check.message || LIMIT_MESSAGES.agents);
        setLimitOpen(true);
        setCreating(false);
        return;
      }

      const resolved = await resolveNotionParentForHire(s.user.id);
      let mappedSteps = (proposal.steps || []).map((st, i) => ({
        id: stepId(),
        actionId: st.actionId,
        name: st.name || st.actionId,
        order: i,
        config: (st.config || {}) as Record<string, unknown>,
        onError: st.onError || "stop",
      }));
      if (resolved.parentId) {
        mappedSteps = injectNotionParentIntoSteps(
          mappedSteps,
          resolved.parentId,
          resolved.parentLabel
        );
      }

      const agent = createAgent({
        userId: s.user.id,
        name: proposal.name || pickedRole?.name || "AI Employee",
        purpose: proposal.purpose || proposal.description || "",
        description: proposal.description || proposal.purpose || "",
        templateType: pickedRole?.id,
        steps: mappedSteps as any,
        status: "active",
        schedule: {
          frequency: proposal.schedule?.frequency || "once",
          enabled: Boolean(proposal.schedule?.enabled),
        },
      });
      let agentId = agent.id;
      try {
        const saved = await saveServerAgent({
          name: agent.name,
          description: agent.description,
          purpose: agent.purpose,
          status: agent.status,
          steps: agent.steps,
          schedule: agent.schedule,
        });
        if (saved.ok && saved.id) {
          agentId = saved.id;
          if (agentId !== agent.id) {
            const st = loadOperatorState();
            st.agents = (st.agents || []).map((a) =>
              a.id === agent.id ? { ...a, id: agentId } : a
            );
            saveOperatorState(st);
          }
        } else if (!saved.ok) {
          console.warn("[Nexa] server hire save:", saved.message);
        }
      } catch (e) {
        console.warn("[Nexa] server hire save failed", e);
      }
      if (scopeRef.current && agentId) {
        migrateBuilderChat(scopeRef.current, employeeScopeId(agentId));
      }
      router.push(`/agents/${agentId}`);
    } catch {
      setError("Could not hire this AI employee. Please try again.");
      setCreating(false);
    }
  };

  const missingConnectors = requiredConnectors.filter(
    (c) => c.status !== "connected" && c.id !== "local_data" && c.id !== "vault"
  );

  const onLivePick = (pick: LivePick) => {
    if (pick.kind === "notion_page" && pick.option?.id) {
      setNotionParent(pick.option.id);
      if (proposal?.steps) {
        const next = {
          ...proposal,
          steps: injectNotionParentIntoSteps(
            proposal.steps,
            pick.option.id,
            pick.option.label
          ),
        };
        setProposal(next);
        persist(lines, next);
      }
    }
    void sendMessage(livePickToMessage(pick));
  };

  return (
    <AppShell>
      <div
        className="mx-auto flex max-w-2xl flex-col px-4 py-6"
        style={{ minHeight: "calc(100vh - 4rem)" }}
      >
        <div className="mb-4">
          <Link href="/agents" className="text-xs text-zinc-500 hover:text-indigo-600">
            ← Digital team
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Hiring Desk
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Pick a role template or describe the job — hire once, reuse for ongoing work.
          </p>
        </div>

        {showDesk && lines.length === 0 && !busy && (
          <section className="mb-6 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Role templates
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => pickTemplate(t)}
                  className="rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {t.role} · {t.department}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{t.description}</p>
                  <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">{t.constraints}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-400">
              Or describe a custom role below. Templates only use tools Nexa already supports.
            </p>
          </section>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto pb-4">
          {lines.map((l, i) => (
            <div
              key={i}
              className={
                l.role === "user"
                  ? "ml-8 rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white"
                  : "mr-4 rounded-xl border border-zinc-100 bg-white px-3 py-2 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              }
            >
              {l.thinking && l.thinking.length > 0 && (
                <ul className="mb-2 space-y-0.5 text-xs text-zinc-400">
                  {l.thinking.map((t, j) => (
                    <li key={j}>✓ {t}</li>
                  ))}
                </ul>
              )}
              <div className="whitespace-pre-wrap">{l.content}</div>
            </div>
          ))}
          {busy && (
            <div className="mr-4 rounded-xl border border-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800">
              Working…
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {proposal && !busy && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {proposal.name || "AI Employee"}
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                {proposal.description || proposal.purpose}
              </p>
              {Array.isArray(proposal.steps) && proposal.steps.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                  {proposal.steps.map((st: any, i: number) => (
                    <li key={i}>• {st.name || st.actionId}</li>
                  ))}
                </ul>
              )}
              {missingConnectors.length > 0 && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Connect: {missingConnectors.map((c) => c.name).join(", ")}
                </p>
              )}
              <button
                type="button"
                disabled={creating}
                onClick={() => void confirmHire()}
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Hiring…" : "Hire AI Employee"}
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 border-t border-zinc-100 bg-zinc-50 pt-3 dark:border-zinc-800 dark:bg-zinc-950">
          <LiveAccountPicker onPick={onLivePick} />
          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Describe the employee you want to hire…"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              disabled={busy || creating}
            />
            <button
              type="button"
              disabled={busy || creating || !input.trim()}
              onClick={() => void sendMessage(input)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            Hire once. Reuse the same employee for ongoing work — no need to rehire for every task.
          </p>
        </div>
      </div>
      <UpgradeLimitModal open={limitOpen} message={error || LIMIT_MESSAGES.agents} onClose={() => setLimitOpen(false)} />
    </AppShell>
  );
}
