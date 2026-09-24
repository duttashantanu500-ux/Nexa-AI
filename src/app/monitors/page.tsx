"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, createMission } from "@/lib/operatorStore";
import { createId } from "@/lib/conversationStore";

interface Monitor {
  id: string;
  name: string;
  type: "competitor" | "market" | "lead" | "website";
  target: string;
  enabled: boolean;
  lastCheckedAt?: string;
}

interface Opportunity {
  id: string;
  title: string;
  reason: string;
  evidence: string;
  source?: string;
  dismissed?: boolean;
}

const MON_KEY = "nexa_monitors_v1";
const OPP_KEY = "nexa_opportunities_v1";

export default function MonitorsPage() {
  const router = useRouter();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [type, setType] = useState<Monitor["type"]>("competitor");

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    try {
      setMonitors(JSON.parse(localStorage.getItem(MON_KEY) || "[]"));
      setOpps(JSON.parse(localStorage.getItem(OPP_KEY) || "[]"));
    } catch {
      /* */
    }
  }, [router]);

  const saveMon = (list: Monitor[]) => {
    setMonitors(list);
    localStorage.setItem(MON_KEY, JSON.stringify(list));
  };

  const saveOpp = (list: Opportunity[]) => {
    setOpps(list);
    localStorage.setItem(OPP_KEY, JSON.stringify(list));
  };

  const add = () => {
    if (!name.trim() || !target.trim()) return;
    const m: Monitor = {
      id: createId(),
      name: name.trim(),
      type,
      target: target.trim(),
      enabled: true,
    };
    saveMon([m, ...monitors]);
    setName("");
    setTarget("");
  };

  /** Manual check: creates a real research mission — does not fabricate findings */
  const checkNow = async (m: Monitor) => {
    const user = loadOperatorState().user;
    if (!user) return;
    const goal = `Monitor check for ${m.name}: research public updates about ${m.target}`;
    const businessContext = loadOperatorState().businessContext;
    const res = await fetch("/api/missions/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, businessContext }),
    });
    const data = await res.json();
    const mission = createMission(user.id, goal, data.plan
      ? { title: data.plan.title, steps: data.plan.steps, researchQuery: data.plan.researchQuery }
      : undefined);
    saveMon(
      monitors.map((x) =>
        x.id === m.id ? { ...x, lastCheckedAt: new Date().toISOString() } : x
      )
    );
    router.push(`/missions/${mission.id}`);
  };

  const createMissionFromOpp = (o: Opportunity) => {
    const user = loadOperatorState().user;
    if (!user) return;
    const goal = o.title + (o.reason ? ` — ${o.reason}` : "");
    router.push("/home");
    // User creates from home; we pre-copy goal via sessionStorage
    sessionStorage.setItem("nexa_prefill_goal", goal);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Monitors</h1>
          <p className="text-sm text-muted">
            Track competitors, markets, and leads. Checks create real research Missions — no
            fabricated findings.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-medium">Add monitor</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Monitor["type"])}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          >
            <option value="competitor">Competitor</option>
            <option value="market">Market</option>
            <option value="lead">Lead</option>
            <option value="website">Website</option>
          </select>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target (company, topic, or URL)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={add}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save monitor
          </button>
        </div>

        <div className="space-y-2">
          {monitors.length === 0 ? (
            <div className="text-sm text-muted">No monitors yet.</div>
          ) : (
            monitors.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-muted">
                    {m.type} · {m.target}
                    {m.lastCheckedAt
                      ? ` · last check ${new Date(m.lastCheckedAt).toLocaleString()}`
                      : ""}
                  </div>
                </div>
                <button
                  onClick={() => checkNow(m)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  Check now
                </button>
              </div>
            ))
          )}
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Opportunities</h2>
          <p className="text-xs text-muted">
            Opportunities appear from completed research Missions you promote — nothing is invented.
          </p>
          {opps.filter((o) => !o.dismissed).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              No opportunities yet.
            </div>
          ) : (
            opps
              .filter((o) => !o.dismissed)
              .map((o) => (
                <div key={o.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="text-sm font-medium">{o.title}</div>
                  <p className="text-sm text-muted">{o.reason}</p>
                  <p className="text-xs text-muted">{o.evidence}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => createMissionFromOpp(o)}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Create Mission
                    </button>
                    <button
                      onClick={() =>
                        saveOpp(
                          opps.map((x) =>
                            x.id === o.id ? { ...x, dismissed: true } : x
                          )
                        )
                      }
                      className="rounded-lg border border-border px-3 py-1.5 text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
