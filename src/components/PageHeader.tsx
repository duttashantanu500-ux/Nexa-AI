"use client";

import type { ReactNode } from "react";
import {
  RobotAvatar,
  type RobotAvatarId,
} from "@/components/robots/RobotAvatar";

const PAGE_ROBOTS: Record<string, RobotAvatarId> = {
  home: "cobalt",
  agents: "violet",
  connections: "moss",
  activity: "pearl",
  settings: "ember",
  plans: "sun",
  vault: "pearl",
  approvals: "ember",
  default: "cobalt",
};

export function PageHeader({
  title,
  subtitle,
  page = "default",
  actions,
  avatarId,
}: {
  title: string;
  subtitle?: string;
  page?: keyof typeof PAGE_ROBOTS | string;
  actions?: ReactNode;
  avatarId?: RobotAvatarId;
}) {
  const robot = avatarId || PAGE_ROBOTS[page] || PAGE_ROBOTS.default;

  return (
    <div className="nexa-enter mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <RobotAvatar id={robot} size="md" className="mt-0.5 shadow-sm" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
