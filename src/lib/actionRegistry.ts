/**
 * Actions come only from the connector registry.
 * Only implemented actions may be added to live workflows.
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
  category: "data" | "web" | "logic" | "output" | "image" | "messaging" | "docs" | "code";
  connectionId: string | null;
  fields: ActionField[];
  readOnly: boolean;
  requiresApproval: boolean;
  available: boolean;
  implemented: boolean;
  availabilityNote?: string;
}

function categoryFor(a: ConnectorAction): ActionDefinition["category"] {
  if (a.connectorId === "local_comfyui") return "image";
  if (a.connectorId === "slack") return "messaging";
  if (a.connectorId === "notion") return "docs";
  if (a.connectorId === "github") return "code";
  if (a.id.includes("report") || a.id.includes("note")) return "output";
  return "data";
}

function toActionDef(a: ConnectorAction): ActionDefinition {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    category: categoryFor(a),
    connectionId: a.connectorId,
    fields: a.fields,
    readOnly: a.readOnly,
    requiresApproval: a.requiresApproval,
    available: a.available && a.implemented,
    implemented: a.implemented,
    availabilityNote: a.unavailableReason,
  };
}

/** Only actions safe to add to a runnable agent */
export function availableActions(): ActionDefinition[] {
  return listAvailableActions().map(toActionDef);
}

/** Full catalog including planned-but-not-implemented (for disabled UI) */
export function catalogActions(): ActionDefinition[] {
  return CONNECTOR_REGISTRY.flatMap((c) => c.actions.map(toActionDef));
}

export function getAction(id: string): ActionDefinition | undefined {
  const a = getConnectorAction(id);
  return a ? toActionDef(a) : undefined;
}

/** @deprecated use availableActions() */
export const ACTION_REGISTRY: ActionDefinition[] = availableActions();

export { WORKFLOW_STARTERS, CONNECTOR_REGISTRY };
