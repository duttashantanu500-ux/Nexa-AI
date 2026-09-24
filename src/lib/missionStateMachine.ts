import { MissionStatus } from "@/types";

const ALLOWED: Record<MissionStatus, MissionStatus[]> = {
  planning: ["ready", "cancelled"],
  ready: ["running", "cancelled", "planning"],
  running: [
    "waiting_approval",
    "paused",
    "completed",
    "failed",
    "cancelled",
  ],
  waiting_approval: ["running", "cancelled", "failed", "completed"],
  paused: ["running", "cancelled", "failed"],
  completed: [],
  failed: ["ready", "running", "cancelled"],
  cancelled: [],
};

export function canTransition(
  from: MissionStatus,
  to: MissionStatus
): boolean {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

export function assertTransition(
  from: MissionStatus,
  to: MissionStatus
): { ok: true } | { ok: false; error: string } {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      error: `Invalid mission transition: ${from} → ${to}`,
    };
  }
  return { ok: true };
}

/** Resource safety limits for a single mission run */
export const MISSION_LIMITS = {
  maxSteps: 12,
  maxToolCalls: 20,
  maxPages: 8,
  maxDurationMs: 55_000,
  maxConcurrentMissions: 3,
};

export function estimateMissionBudget(goal: string) {
  const research = /find|research|prospect|competitor|market/i.test(goal);
  return {
    estimatedToolCalls: research ? 10 : 4,
    estimatedMinutes: research ? 1 : 1,
    aiUsage: "low" as const,
    note: research
      ? "Uses web search and page reads. Read-only."
      : "Light research run.",
  };
}
