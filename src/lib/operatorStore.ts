import {
  Agent,
  AgentRun,
  AgentSchedule,
  AppState,
  BusinessContext,
  Connection,
  DEFAULT_CONNECTIONS,
  UserProfile,
  computeNextRun,
  defaultPermissions,
  defaultSchedule,
} from "@/types";

const KEY = "nexa_operator_v3";

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyState(): AppState {
  return {
    user: null,
    businessContext: null,
    theme: "system",
    agents: [],
    agentRuns: [],
    connections: structuredClone(DEFAULT_CONNECTIONS),
  };
}

export function loadOperatorState(): AppState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // migrate from older keys
      const old = localStorage.getItem("nexa_operator_v1");
      if (old) {
        const parsed = JSON.parse(old);
        return migrateLegacy(parsed);
      }
      return emptyState();
    }
    const parsed = JSON.parse(raw) as AppState;
    return normalize(parsed);
  } catch {
    return emptyState();
  }
}

function migrateLegacy(parsed: any): AppState {
  const base = emptyState();
  base.user = parsed.user || null;
  base.businessContext = parsed.businessContext || null;
  base.theme = parsed.theme || "system";
  base.agents = (parsed.agents || []).map(normalizeAgent);
  base.agentRuns = parsed.agentRuns || [];
  base.connections = mergeConnections(parsed.connections);
  saveOperatorState(base);
  return base;
}

function normalize(s: AppState): AppState {
  return {
    user: s.user || null,
    businessContext: s.businessContext || null,
    theme: s.theme || "system",
    agents: (s.agents || []).map(normalizeAgent),
    agentRuns: s.agentRuns || [],
    connections: mergeConnections(s.connections),
  };
}

function normalizeAgent(a: any): Agent {
  const schedule: AgentSchedule = a.schedule?.frequency
    ? { ...defaultSchedule(), ...a.schedule }
    : defaultSchedule();
  if (schedule.enabled && schedule.frequency !== "once" && !schedule.nextRunAt) {
    schedule.nextRunAt = computeNextRun(schedule);
  }
  return {
    id: a.id,
    userId: a.userId,
    name: a.name || "Agent",
    description: a.description || a.purpose || "",
    purpose: a.purpose || a.description || "",
    instructions: a.instructions || "",
    expectedOutput: a.expectedOutput || "",
    constraints: a.constraints || "",
    templateType: a.templateType,
    status: a.status === "paused" || a.status === "error" ? a.status : "active",
    tools: Array.isArray(a.tools) ? a.tools : ["web_search", "web_page_reader"],
    permissions: a.permissions || defaultPermissions(),
    schedule,
    lastRunAt: a.lastRunAt || null,
    lastRunStatus: a.lastRunStatus || null,
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || a.createdAt || new Date().toISOString(),
  };
}

function mergeConnections(existing?: Connection[]): Connection[] {
  const defaults = structuredClone(DEFAULT_CONNECTIONS);
  if (!existing?.length) return defaults;
  return defaults.map((d) => {
    const found = existing.find((c) => c.id === d.id);
    if (!found) return d;
    // Never trust client "connected" for OAuth services without verification
    if (d.provider !== "builtin" && d.status === "not_supported") {
      return { ...d, mcpUrl: found.mcpUrl, mcpTools: found.mcpTools };
    }
    if (d.id === "mcp" && found.status === "connected" && found.mcpUrl) {
      return { ...found, name: d.name, description: d.description };
    }
    if (d.provider === "builtin") return { ...d, status: "connected" };
    return { ...d, ...found, status: found.status || d.status };
  });
}

export function saveOperatorState(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function setUser(user: UserProfile | null) {
  const s = loadOperatorState();
  s.user = user;
  saveOperatorState(s);
  return s;
}

export function setBusinessContext(ctx: BusinessContext | null) {
  const s = loadOperatorState();
  s.businessContext = ctx;
  saveOperatorState(s);
  return s;
}

export function setTheme(theme: AppState["theme"]) {
  const s = loadOperatorState();
  s.theme = theme;
  saveOperatorState(s);
  return s;
}

export function createAgent(
  input: Omit<
    Agent,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "status"
    | "lastRunAt"
    | "lastRunStatus"
  > & { status?: Agent["status"] }
): Agent {
  const s = loadOperatorState();
  const schedule = {
    ...defaultSchedule(),
    ...input.schedule,
  };
  schedule.nextRunAt = computeNextRun(schedule);

  const agent: Agent = {
    id: uid("agent"),
    userId: input.userId,
    name: input.name.trim(),
    description: input.description || input.purpose || "",
    purpose: input.purpose || input.description || "",
    instructions: input.instructions || "",
    expectedOutput: input.expectedOutput || "",
    constraints: input.constraints || "",
    templateType: input.templateType,
    status: input.status || "active",
    tools: input.tools?.length ? input.tools : ["web_search", "web_page_reader"],
    permissions: input.permissions || defaultPermissions(),
    schedule,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  s.agents = [agent, ...s.agents];
  saveOperatorState(s);
  return agent;
}

export function updateAgent(id: string, patch: Partial<Agent>): Agent | null {
  const s = loadOperatorState();
  const idx = s.agents.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const next = { ...s.agents[idx], ...patch, id, updatedAt: new Date().toISOString() };
  if (patch.schedule) {
    next.schedule = { ...s.agents[idx].schedule, ...patch.schedule };
    next.schedule.nextRunAt = computeNextRun(next.schedule);
  }
  s.agents[idx] = next;
  saveOperatorState(s);
  return next;
}

export function deleteAgent(id: string) {
  const s = loadOperatorState();
  s.agents = s.agents.filter((a) => a.id !== id);
  s.agentRuns = s.agentRuns.filter((r) => r.agentId !== id);
  saveOperatorState(s);
}

export function getAgent(id: string): Agent | null {
  return loadOperatorState().agents.find((a) => a.id === id) || null;
}

export function listAgentRuns(agentId: string): AgentRun[] {
  return loadOperatorState()
    .agentRuns.filter((r) => r.agentId === agentId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function addAgentRun(run: AgentRun) {
  const s = loadOperatorState();
  s.agentRuns = [run, ...s.agentRuns].slice(0, 200);
  const agent = s.agents.find((a) => a.id === run.agentId);
  if (agent) {
    agent.lastRunAt = run.startedAt;
    agent.lastRunStatus = run.status;
    agent.updatedAt = new Date().toISOString();
  }
  saveOperatorState(s);
  return run;
}

export function updateAgentRun(id: string, patch: Partial<AgentRun>) {
  const s = loadOperatorState();
  const idx = s.agentRuns.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  s.agentRuns[idx] = { ...s.agentRuns[idx], ...patch };
  const run = s.agentRuns[idx];
  const agent = s.agents.find((a) => a.id === run.agentId);
  if (agent) {
    agent.lastRunAt = run.startedAt;
    agent.lastRunStatus = run.status;
    agent.updatedAt = new Date().toISOString();
  }
  saveOperatorState(s);
  return run;
}

export function createRunId() {
  return uid("run");
}

export function updateConnection(id: string, patch: Partial<Connection>) {
  const s = loadOperatorState();
  s.connections = s.connections.map((c) =>
    c.id === id ? { ...c, ...patch } : c
  );
  saveOperatorState(s);
  return s;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem("nexa_operator_v1");
}
