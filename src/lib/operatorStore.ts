import {
  AppState,
  Mission,
  MissionStatus,
  MissionStep,
  MissionDeliverable,
  Agent,
  ActivityEvent,
  ApprovalRequest,
  Connection,
  DEFAULT_CONNECTIONS,
  AGENT_TEMPLATES,
  BusinessContext,
  UserProfile,
} from "@/types";
import { loadAppState, saveAppState, createId } from "./conversationStore";

function ensureOperatorDefaults(state: AppState): AppState {
  return {
    ...state,
    missions: state.missions || [],
    agents: state.agents || [],
    connections: state.connections?.length ? state.connections : DEFAULT_CONNECTIONS,
    activity: state.activity || [],
    approvals: state.approvals || [],
  };
}

export function loadOperatorState(): AppState {
  return ensureOperatorDefaults(loadAppState());
}

export function saveOperatorState(partial: Partial<AppState>): AppState {
  const current = loadOperatorState();
  return saveAppState({ ...current, ...partial });
}

function titleFromGoal(goal: string): string {
  const cleaned = goal.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 48) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned.slice(0, 45).trim() + "…";
}

/** Create mission in planning state — plan filled by API */
export function createMission(
  userId: string,
  goal: string,
  plan?: { title?: string; steps?: MissionStep[]; researchQuery?: string }
): Mission {
  const now = new Date().toISOString();
  const mission: Mission = {
    id: createId(),
    userId,
    title: plan?.title || titleFromGoal(goal),
    goal: goal.trim(),
    status: plan?.steps?.length ? "ready" : "planning",
    progress: plan?.steps?.length ? 5 : 0,
    plan: plan?.steps || [],
    activity: [
      {
        id: createId(),
        text: "Mission created",
        at: now,
        type: "success",
      },
    ],
    tools: ["web_search", "web_page_reader"],
    researchQuery: plan?.researchQuery,
    createdAt: now,
    updatedAt: now,
  };

  if (plan?.steps?.length) {
    mission.activity.push({
      id: createId(),
      text: "Plan generated — review and start when ready",
      at: now,
      type: "info",
    });
  }

  const state = loadOperatorState();
  const missions = [mission, ...(state.missions || [])];
  const activity: ActivityEvent = {
    id: createId(),
    userId,
    text: `Mission created: ${mission.title}`,
    at: now,
    category: "mission",
    refId: mission.id,
  };
  saveOperatorState({
    missions,
    activity: [activity, ...(state.activity || [])],
  });
  return mission;
}

export function getMission(id: string): Mission | null {
  return loadOperatorState().missions.find((m) => m.id === id) || null;
}

export function updateMission(id: string, patch: Partial<Mission>): Mission | null {
  const state = loadOperatorState();
  let updated: Mission | null = null;
  const missions = state.missions.map((m) => {
    if (m.id !== id) return m;
    updated = { ...m, ...patch, updatedAt: new Date().toISOString() };
    return updated;
  });
  if (!updated) return null;
  saveOperatorState({ missions });
  return updated;
}

export function appendMissionActivity(id: string, text: string, type?: Mission["activity"][0]["type"]) {
  const m = getMission(id);
  if (!m) return null;
  const activity = [
    ...m.activity,
    { id: createId(), text, at: new Date().toISOString(), type },
  ];
  return updateMission(id, { activity });
}

export function setMissionStatus(id: string, status: MissionStatus): Mission | null {
  const progressMap: Partial<Record<MissionStatus, number>> = {
    planning: 5,
    ready: 10,
    running: 40,
    waiting_approval: 70,
    completed: 100,
    failed: 100,
    paused: 40,
    cancelled: 100,
  };
  return updateMission(id, {
    status,
    progress: progressMap[status] ?? undefined,
  });
}

export function saveMissionDeliverable(
  id: string,
  deliverable: MissionDeliverable,
  resultText: string
) {
  return updateMission(id, {
    deliverable,
    result: resultText,
    status: "completed",
    progress: 100,
  });
}

export function ensureDefaultAgents(userId: string): Agent[] {
  const state = loadOperatorState();
  if (state.agents?.length) return state.agents;
  const agents: Agent[] = AGENT_TEMPLATES.map((t) => ({
    ...t,
    id: createId(),
    userId,
    createdAt: new Date().toISOString(),
  }));
  saveOperatorState({ agents });
  return agents;
}

export function createAgent(params: {
  userId: string;
  name: string;
  purpose: string;
  instructions?: string;
  tools: string[];
}): Agent {
  const agent: Agent = {
    id: createId(),
    userId: params.userId,
    name: params.name.trim(),
    purpose: params.purpose.trim(),
    instructions: params.instructions,
    status: "idle",
    tools: params.tools,
    schedule: "On demand",
    recentActivity: "Just created",
    isTemplate: false,
    createdAt: new Date().toISOString(),
  };
  const state = loadOperatorState();
  saveOperatorState({ agents: [agent, ...(state.agents || [])] });
  pushActivity(params.userId, `Agent created: ${agent.name}`, "agent", agent.id);
  return agent;
}

export function toggleConnection(id: string): Connection[] {
  const state = loadOperatorState();
  const connections = (state.connections || DEFAULT_CONNECTIONS).map((c) =>
    c.id === id
      ? {
          ...c,
          status:
            c.status === "connected"
              ? ("not_connected" as const)
              : ("connected" as const),
        }
      : c
  );
  saveOperatorState({ connections });
  return connections;
}

export function addMcpConnection(name: string, mcpUrl: string): Connection[] {
  const state = loadOperatorState();
  const conn: Connection = {
    id: createId(),
    name: name.trim() || "Custom MCP",
    provider: "mcp",
    status: "not_connected",
    description: "User-provided MCP endpoint (runtime not live yet)",
    mcpUrl: mcpUrl.trim(),
    mcpTools: [],
  };
  const connections = [conn, ...(state.connections || DEFAULT_CONNECTIONS)];
  saveOperatorState({ connections });
  return connections;
}

export function pushActivity(
  userId: string,
  text: string,
  category: ActivityEvent["category"] = "system",
  refId?: string
) {
  const state = loadOperatorState();
  const event: ActivityEvent = {
    id: createId(),
    userId,
    text,
    at: new Date().toISOString(),
    category,
    refId,
  };
  saveOperatorState({ activity: [event, ...(state.activity || [])] });
}

export function createApproval(
  userId: string,
  title: string,
  summary: string,
  missionId?: string,
  actionId?: string
): ApprovalRequest {
  const req: ApprovalRequest = {
    id: createId(),
    userId,
    title,
    summary,
    status: "pending",
    missionId,
    actionId,
    createdAt: new Date().toISOString(),
  };
  const state = loadOperatorState();
  saveOperatorState({ approvals: [req, ...(state.approvals || [])] });
  pushActivity(userId, `Approval requested: ${title}`, "approval", req.id);
  return req;
}

export function resolveApproval(
  id: string,
  status: "approved" | "rejected"
): ApprovalRequest | null {
  const state = loadOperatorState();
  let found: ApprovalRequest | null = null;
  const approvals = state.approvals.map((a) => {
    if (a.id !== id) return a;
    found = { ...a, status };
    return found;
  });
  if (!found) return null;
  saveOperatorState({ approvals });
  return found;
}

export function updateBusinessProfile(patch: Partial<BusinessContext>): BusinessContext {
  const state = loadOperatorState();
  const next = { ...(state.businessContext || {}), ...patch };
  saveOperatorState({ businessContext: next });
  return next;
}

export function requireUser(): UserProfile | null {
  return loadOperatorState().user;
}
