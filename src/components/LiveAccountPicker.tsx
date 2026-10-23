"use client";

import { useCallback, useEffect, useState } from "react";
import { loadOperatorState } from "@/lib/operatorStore";

export type LiveOption = {
  id: string;
  label: string;
  meta?: string;
};

export type LiveAccountOptions = {
  notionPages: LiveOption[];
  slackChannels: LiveOption[];
  bufferChannels: LiveOption[];
  hubspotContacts: LiveOption[];
  hubspotDeals: LiveOption[];
  errors?: Partial<Record<string, string>>;
};

export type LivePick =
  | { kind: "notion_page"; option: LiveOption }
  | { kind: "slack_channel"; option: LiveOption }
  | { kind: "buffer_channel"; option: LiveOption }
  | { kind: "hubspot_contact"; option: LiveOption }
  | { kind: "hubspot_deal"; option: LiveOption };

/** Build a short chat line the builder can apply to step config. */
export function livePickToMessage(pick: LivePick): string {
  switch (pick.kind) {
    case "notion_page":
      return `Use Notion parent page "${pick.option.label}" (id ${pick.option.id}) for create page steps.`;
    case "slack_channel":
      return `Use Slack channel ${pick.option.label} (id ${pick.option.id}) for post message steps.`;
    case "buffer_channel":
      return `Use Buffer channel "${pick.option.label}" (id ${pick.option.id}) for create post steps.`;
    case "hubspot_contact":
      return `Target HubSpot contact "${pick.option.label}" (id ${pick.option.id}).`;
    case "hubspot_deal":
      return `Target HubSpot deal "${pick.option.label}" (id ${pick.option.id}).`;
  }
}

type Props = {
  onPick: (pick: LivePick) => void;
  className?: string;
};

function ChipRow({
  title,
  options,
  onPick,
}: {
  title: string;
  options: LiveOption[];
  onPick: (o: LiveOption) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o)}
            title={o.meta || o.id}
            className="max-w-full truncate rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:border-indigo-400 hover:bg-indigo-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LiveAccountPicker({ onPick, className }: Props) {
  const [options, setOptions] = useState<LiveAccountOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = loadOperatorState();
      const userId = s.user?.id || "";
      if (!userId) {
        setOptions(null);
        setLoading(false);
        return;
      }
      const res = await fetch(
        `/api/connections/live-options?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.options) {
        setOptions(data.options as LiveAccountOptions);
      } else {
        setError(data.message || "Could not load account targets");
        setOptions(null);
      }
    } catch {
      setError("Could not load account targets");
      setOptions(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasAny =
    options &&
    (options.notionPages.length > 0 ||
      options.slackChannels.length > 0 ||
      options.bufferChannels.length > 0 ||
      options.hubspotContacts.length > 0 ||
      options.hubspotDeals.length > 0);

  if (loading) {
    return (
      <p className={`text-xs text-zinc-500 ${className || ""}`}>
        Loading targets from your connected accounts…
      </p>
    );
  }

  if (!hasAny) {
    return (
      <p className={`text-xs text-zinc-500 ${className || ""}`}>
        {error
          ? error
          : "Connect Notion, Slack, Buffer, or HubSpot under Connections to pick real pages and channels here."}
      </p>
    );
  }

  return (
    <div
      className={`space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50 ${className || ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Pick from your connected accounts
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Refresh
        </button>
      </div>
      <ChipRow
        title="Notion pages"
        options={options!.notionPages}
        onPick={(o) => onPick({ kind: "notion_page", option: o })}
      />
      <ChipRow
        title="Slack channels"
        options={options!.slackChannels}
        onPick={(o) => onPick({ kind: "slack_channel", option: o })}
      />
      <ChipRow
        title="Buffer channels"
        options={options!.bufferChannels}
        onPick={(o) => onPick({ kind: "buffer_channel", option: o })}
      />
      <ChipRow
        title="HubSpot contacts"
        options={options!.hubspotContacts}
        onPick={(o) => onPick({ kind: "hubspot_contact", option: o })}
      />
      <ChipRow
        title="HubSpot deals"
        options={options!.hubspotDeals}
        onPick={(o) => onPick({ kind: "hubspot_deal", option: o })}
      />
    </div>
  );
}
