/**
 * Compatibility layer — actions come from connector registry only.
 * Web search is NOT in the available set.
 */

import {
  CONNECTOR_REGISTRY,
  WORKFLOW_STARTERS,
  getAction,
  listAvailableActions,
  type ConnectorAction,
  type ActionField,
} from "./connectors/registry";

export type { ActionField };

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  category: "data" | "web" | "logic" | "output" | "image";
  connectionId: string | null;
  fields: ActionField[];
  readOnly: boolean;
  requiresApproval: boolean;
  available: boolean;
  availabilityNote?: string;
}

function toActionDef(a: ConnectorAction): ActionDefinition {
  const cat =
    a.connectorId === "local_comfyui"
      ? "image"
      : a.id.includes("report") || a.id.includes("note")
        ? "output"
        : "data";
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    category: cat,
    connectionId: a.connectorId,
    fields: a.fields,
    readOnly: a.readOnly,
    requiresApproval: a.requiresApproval,
    available: a.available,
    availabilityNote: a.unavailableReason,
  };
}

/** Only executable, available actions — no web search */
export const ACTION_REGISTRY: ActionDefinition[] = listAvailableActions().map(toActionDef);

export function getActionDef(id: string): ActionDefinition | undefined {
  const a = getAction(id);
  return a ? toActionDef(a) : undefined;
}

// Alias used by builder pages
export function getAction(id: string): ActionDefinition | undefined {
  return getActionDef(id);
}

export function availableActions(): ActionDefinition[] {
  return ACTION_REGISTRY.filter((a) => a.available);
}

export { WORKFLOW_STARTERS, CONNECTOR_REGISTRY };
