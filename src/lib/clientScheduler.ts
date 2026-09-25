/**
 * Client-side due-schedule detection (honest: only while the app is open).
 * Not a substitute for server cron.
 */

import type { Agent } from "@/types";
import { computeNextRun, loadOperatorState, updateAgent } from "./operatorStore";

export interface DueAgent {
  agent: Agent;
  nextRunAt: string;
}

export function listDueAgents(now = Date.now()): DueAgent[] {
  const s = loadOperatorState();
  const due: DueAgent[] = [];
  for (const agent of s.agents) {
    if (agent.status === "paused" || agent.status === "archived") continue;
    if (!agent.schedule?.enabled) continue;
    if (agent.schedule.frequency === "once") continue;
    const next = agent.schedule.nextRunAt;
    if (!next) continue;
    if (Date.parse(next) <= now) {
      due.push({ agent, nextRunAt: next });
    }
  }
  return due;
}

/** Advance nextRunAt after a client-side scheduled run */
export function advanceAgentSchedule(agentId: string) {
  const s = loadOperatorState();
  const agent = s.agents.find((a) => a.id === agentId);
  if (!agent) return;
  const next = computeNextRun(agent.schedule);
  updateAgent(agentId, {
    schedule: {
      ...agent.schedule,
      nextRunAt: next,
      lastRunAt: new Date().toISOString(),
      lastRunStatus: "succeeded",
      consecutiveFailures: 0,
    },
  });
}

export function markScheduleFailure(agentId: string) {
  const s = loadOperatorState();
  const agent = s.agents.find((a) => a.id === agentId);
  if (!agent) return;
  updateAgent(agentId, {
    schedule: {
      ...agent.schedule,
      lastRunAt: new Date().toISOString(),
      lastRunStatus: "failed",
      consecutiveFailures: (agent.schedule.consecutiveFailures || 0) + 1,
      nextRunAt: computeNextRun(agent.schedule),
    },
  });
}
