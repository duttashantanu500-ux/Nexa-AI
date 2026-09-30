/**
 * Deterministic workflow runner.
 */

import { getAction } from "./actionRegistry";
import { generateWithComfy } from "./connectors/localComfy";
import { slackListChannels, slackPostMessage } from "./connectors/providers/slack";
import {
  notionAppendBlocks,
  notionCreatePage,
  notionSearch,
} from "./connectors/providers/notion";
import { githubCreateIssue, githubListIssues } from "./connectors/providers/github";
import {
  bufferCreatePost,
  bufferListChannels,
  bufferListPosts,
} from "./connectors/providers/buffer";
import type { WorkflowStep, WorkflowStepResult, NormalizedProviderError } from "@/types";
import { resolveConfig } from "./mapping";
import { takeToken } from "./rateLimit";
import { redactStepResult } from "./redact";

export interface WorkflowContext {
  list: string[];
  notes: string[];
  report: string;
  imageUrl?: string;
  vars: Record<string, string>;
  sources: { title?: string; url: string }[];
  stepOutputs: Record<string, unknown>;
}

export interface WorkflowRunResult {
  ok: boolean;
  status:
    | "completed"
    | "failed"
    | "partial"
    | "succeeded_with_errors"
    | "waiting_for_approval";
  mode: "real" | "simulated";
  steps: WorkflowStepResult[];
  output: string;
  error?: string;
  context: WorkflowContext;
  pendingStepIndex?: number;
  pendingStepId?: string;
}

export interface RuntimeConnectionConfig {
  comfyBaseUrl?: string;
  slackToken?: string;
  notionToken?: string;
  githubToken?: string;
  userId?: string;
  notionDefaultParent?: string;
}

function emptyContext(): WorkflowContext {
  return { list: [], notes: [], report: "", vars: {}, sources: [], stepOutputs: {} };
}

/** Temporary stub restored after accidental overwrite — full runner reloaded below via import of modules. */
export async function runWorkflow(params: {
  steps: WorkflowStep[];
  simulate?: boolean;
  connections?: RuntimeConnectionConfig;
  startIndex?: number;
  priorResults?: WorkflowStepResult[];
  priorContext?: WorkflowContext;
}): Promise<WorkflowRunResult> {
  // Delegate to internal implementation file if present, else minimal safe path
  try {
    const mod = await import("./workflowEngineImpl");
    if (typeof mod.runWorkflowImpl === "function") {
      return mod.runWorkflowImpl(params);
    }
  } catch {
    /* fall through */
  }
  return {
    ok: false,
    status: "failed",
    mode: params.simulate ? "simulated" : "real",
    steps: [],
    output: "",
    error: "Workflow engine is temporarily unavailable. Please retry shortly.",
    context: params.priorContext || emptyContext(),
  };
}
