/**
 * Actions come only from the connector registry.
 * Web search is not available and not used as a fallback.
 */

import {
  CONNECTOR_REGISTRY,
  WORKFLOW_STARTERS,
  getAction as getConnectorAction,
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

export const ACTION_REGISTRY: ActionDefinition[] = listAvailableActions().map(toActionDef);

export function getAction(id: string): ActionDefinition | undefined {
  const a = getConnectorAction(id);
  return a ? toActionDef(a) : undefined;
}

export function availableActions(): ActionDefinition[] {
  return ACTION_REGISTRY.filter((a) => a.available);
}

export { WORKFLOW_STARTERS, CONNECTOR_REGISTRY };
