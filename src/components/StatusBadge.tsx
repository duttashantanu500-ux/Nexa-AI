import { cn } from "@/lib/utils";
import { MissionStatus, AgentStatus } from "@/types";

const missionStyles: Record<MissionStatus, string> = {
  planning: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  ready: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  running: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  waiting_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  paused: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

const missionLabel: Record<MissionStatus, string> = {
  planning: "Planning",
  ready: "Ready",
  running: "Running",
  waiting_approval: "Waiting for approval",
  completed: "Completed",
  failed: "Failed",
  paused: "Paused",
};

export function MissionBadge({ status }: { status: MissionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        missionStyles[status]
      )}
    >
      {missionLabel[status]}
    </span>
  );
}

export function AgentBadge({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, string> = {
    idle: "Idle",
    active: "Active",
    paused: "Paused",
    error: "Error",
  };
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {map[status]}
    </span>
  );
}
