import {
  Agent,
  AgentRun,
  AgentSchedule,
  AppState,
  BusinessContext,
  Connection,
  DEFAULT_CONNECTIONS,
  UserProfile,
  WorkflowStep,
  computeNextRun,
  defaultPermissions,
  defaultSchedule,
  deriveAgentStatus,
} from "@/types";

const KEY = "nexa_operator_v4";

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyState(): AppState {
  return {
    user: null,
    businessContext: null,
    theme: "light",
    agents: [],
    agentRuns: [],
    connections: structuredClone(DEFAULT_CONNECTIONS),
    connectionRecords: [],
  };
}

export function loadOperatorState(): AppState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const old =
        localStorage.getItem("nexa_operator_v3") ||
        localStorage.getItem("nexa_operator_v1");
      if (old) {
        const parsed = JSON.parse(old);
        return migrateLegacy(parsed);
      }
      return emptyState();
    }
    return normalize(JSON.parse(raw) as AppState);
  } catch {
    return emptyState();
  }
}

function migrateLegacy(parsed: any): AppState {
  const base = emptyState();
  base.user = parsed.user || null;
  base.businessContext = parsed.businessContext || null;
  base.theme = parsed.theme || "light";
  base.agents = (parsed.agents || []).map(normalizeAgent);
  base.agentRuns = parsed.agentRuns || [];
  base.connections = mergeConnections(parsed.connections);
  base.connectionRecords = parsed.connectionRecords || [];
  saveOperatorState(base);
  return base;
}

function normalize(s: AppState): AppState {
  return {
    user: s.user || null,
    businessContext: s.businessContext || null,
    theme: s.theme || "light",
    agents: (s.agents || []).map(normalizeAgent),
    agentRuns: s.agentRuns || [],
    connections: mergeConnections(s.connections),
    connectionRecords: s.connectionRecords || [],
  };
}

function normalizeAgent(a: any): Agent {
  const schedule: AgentSchedule = a.schedule?.frequency
    ? { ...defaultSchedule(), ...a.schedule }
    : defaultSchedule();
  if (schedule.enabled && schedule.frequency !== "once" && !schedule.nextRunAt) {
    schedule.nextRunAt = computeNextRun(schedule);
  }
  const steps: WorkflowStep[] = Array.isArray(a.steps)
    ? a.steps.map((s: any, i: number) => ({
        id: s.id || uid("step"),
        order: s.order ?? i,
        type: s.type || "action",
        actionId: s.actionId,
        name: s.name || s.actionId,
        connectorId: s.connectorId,
        connectionId: s.connectionId,
        config: s.config || {},
        inputMapping: s.inputMapping,
        outputKey: s.outputKey,
        onError: s.onError || "stop",
        retryPolicy: s.retryPolicy,
        requiresApproval: s.requiresApproval,
        condition: s.condition,
      }))
    : [];

  const agent: Agent = {
    id: a.id,
    userId: a.userId,
    name: a.name || "Agent",
    description: a.description || a.purpose || "",
    purpose: a.purpose || a.description || "",
    instructions: a.instructions || "",
    expectedOutput: a.expectedOutput || "",
    constraints: a.constraints || "",
    templateType: a.templateType,
    status: a.status || "draft",
    version: typeof a.version === "number" ? a.version : 1,
    tools: Array.isArray(a.tools) ? a.tools : [],
    steps,
    permissions: a.permissions || defaultPermissions(),
    schedule,
    lastRunAt: a.lastRunAt || null,
    lastRunStatus: a.lastRunStatus || null,
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || a.createdAt || new Date().toISOString(),
  };
  agent.status = deriveAgentStatus(agent);
  return agent;
}

function mergeConnections(existing?: Connection[]): Connection[] {
  const defaults = structuredClone(DEFAULT_CONNECTIONS);
  if (!existing?.length) return defaults;
  return defaults.map((d) => {
    const found = existing.find((c) => c.id === d.id);
    if (!found) return d;
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
  input: Partial<Agent> & { userId: string; name: string }
): Agent {
  const s = loadOperatorState();
  const schedule = { ...defaultSchedule(), ...(input.schedule || {}) };
  schedule.nextRunAt = computeNextRun(schedule);
  const steps = (input.steps || []).map((st, i) => ({
    ...st,
    id: st.id || uid("step"),
    order: st.order ?? i,
    type: st.type || "action",
    onError: st.onError || "stop",
  }));

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
    status: input.status || (steps.length ? "ready" : "draft"),
    version: 1,
    tools: input.tools || [],
    steps,
    permissions: input.permissions || defaultPermissions(),
    schedule,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  agent.status = deriveAgentStatus(agent);
  s.agents = [agent, ...s.agents];
  saveOperatorState(s);
  return agent;
}

export function updateAgent(id: string, patch: Partial<Agent>): Agent | null {
  const s = loadOperatorState();
  const idx = s.agents.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const prev = s.agents[idx];
  const next = { ...prev, ...patch, id, updatedAt: new Date().toISOString() };
  if (patch.schedule) {
    next.schedule = { ...prev.schedule, ...patch.schedule };
    next.schedule.nextRunAt = computeNextRun(next.schedule);
  }
  if (patch.steps) {
    next.steps = patch.steps;
    // Bump version on structural step changes
    next.version = (prev.version || 1) + 1;
  }
  next.status = deriveAgentStatus(next);
  s.agents[idx] = next;
  saveOperatorState(s);
  return next;
}

export function duplicateAgent(id: string): Agent | null {
  const src = getAgent(id);
  if (!src) return null;
  return createAgent({
    ...src,
    name: `${src.name} (copy)`,
    status: "draft",
  });
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
  localStorage.removeItem("nexa_operator_v3");
  localStorage.removeItem("nexa_operator_v1");
}

export function stepId() {
  return uid("step");
}
