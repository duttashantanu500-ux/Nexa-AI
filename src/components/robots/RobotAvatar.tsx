"use client";

import { useMemo } from "react";

/** Curated original Nexa robot identities (not based on any third-party brand). */
export const ROBOT_AVATARS = [
  { id: "cobalt", label: "Cobalt", role: "General", primary: "#3B82F6", secondary: "#1E40AF", accent: "#93C5FD" },
  { id: "pearl", label: "Pearl", role: "Research", primary: "#E2E8F0", secondary: "#94A3B8", accent: "#6366F1" },
  { id: "ember", label: "Ember", role: "Creative", primary: "#F97316", secondary: "#C2410C", accent: "#FDBA74" },
  { id: "moss", label: "Moss", role: "Organize", primary: "#10B981", secondary: "#047857", accent: "#6EE7B7" },
  { id: "violet", label: "Violet", role: "Workflow", primary: "#8B5CF6", secondary: "#5B21B6", accent: "#C4B5FD" },
  { id: "sun", label: "Sun", role: "Support", primary: "#EAB308", secondary: "#A16207", accent: "#FDE047" },
] as const;

export type RobotAvatarId = (typeof ROBOT_AVATARS)[number]["id"];

export function isRobotAvatarId(v: unknown): v is RobotAvatarId {
  return typeof v === "string" && ROBOT_AVATARS.some((r) => r.id === v);
}

/** Stable default avatar from any string id (employee id / name). */
export function avatarIdFromSeed(seed: string): RobotAvatarId {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ROBOT_AVATARS[h % ROBOT_AVATARS.length].id;
}

const AVATAR_STORAGE = "nexa_agent_avatars_v1";

export function loadAvatarMap(): Record<string, RobotAvatarId> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, RobotAvatarId> = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      if (isRobotAvatarId(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveAgentAvatar(agentId: string, avatarId: RobotAvatarId) {
  if (typeof window === "undefined" || !agentId) return;
  const map = loadAvatarMap();
  map[agentId] = avatarId;
  localStorage.setItem(AVATAR_STORAGE, JSON.stringify(map));
}

export function resolveAgentAvatar(
  agentId: string,
  preferred?: string | null
): RobotAvatarId {
  if (isRobotAvatarId(preferred)) return preferred;
  const map = loadAvatarMap();
  if (map[agentId]) return map[agentId];
  return avatarIdFromSeed(agentId || "nexa");
}

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  xs: 28,
  sm: 40,
  md: 56,
  lg: 80,
  xl: 120,
};

export function RobotAvatar({
  id,
  size = "md",
  className = "",
  animated = false,
  title,
}: {
  id: RobotAvatarId;
  size?: Size;
  className?: string;
  animated?: boolean;
  title?: string;
}) {
  const theme = useMemo(
    () => ROBOT_AVATARS.find((r) => r.id === id) || ROBOT_AVATARS[0],
    [id]
  );
  const px = SIZE_PX[size];
  const uid = `r_${theme.id}_${px}`;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${animated ? "nexa-float" : ""} ${className}`}
      style={{ width: px, height: px }}
      title={title || theme.label}
      aria-hidden={title ? undefined : true}
    >
      <div
        className="absolute inset-0 rounded-full opacity-90 shadow-md"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${theme.accent}55, transparent 55%), linear-gradient(145deg, ${theme.primary}, ${theme.secondary})`,
        }}
      />
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className="relative z-[1]"
        role="img"
        aria-label={title || `${theme.label} robot`}
      >
        <defs>
          <linearGradient id={`${uid}_face`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor={theme.accent} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="10" r="3" fill={theme.accent} />
        <rect x="30.5" y="12" width="3" height="6" rx="1.5" fill={theme.secondary} />
        <rect x="16" y="16" width="32" height="26" rx="10" fill={`url(#${uid}_face)`} stroke={theme.secondary} strokeWidth="1.5" />
        <rect x="22" y="25" width="8" height="6" rx="2" fill={theme.secondary} />
        <rect x="34" y="25" width="8" height="6" rx="2" fill={theme.secondary} />
        <circle cx="25" cy="28" r="1.4" fill="#fff" />
        <circle cx="37" cy="28" r="1.4" fill="#fff" />
        <path d="M26 34c2 2.5 10 2.5 12 0" stroke={theme.secondary} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <rect x="20" y="42" width="24" height="14" rx="6" fill={theme.primary} stroke={theme.secondary} strokeWidth="1.2" />
        <circle cx="26" cy="49" r="2.2" fill={theme.accent} opacity="0.9" />
        <circle cx="32" cy="49" r="2.2" fill={theme.accent} opacity="0.9" />
        <circle cx="38" cy="49" r="2.2" fill={theme.accent} opacity="0.9" />
        <rect x="10" y="44" width="8" height="4" rx="2" fill={theme.secondary} />
        <rect x="46" y="44" width="8" height="4" rx="2" fill={theme.secondary} />
      </svg>
    </div>
  );
}

export function RobotAvatarPicker({
  value,
  onChange,
}: {
  value: RobotAvatarId;
  onChange: (id: RobotAvatarId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROBOT_AVATARS.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`rounded-2xl border p-1.5 transition ${
            value === r.id
              ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900"
              : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
          }`}
          title={`${r.label} · ${r.role}`}
        >
          <RobotAvatar id={r.id} size="sm" />
        </button>
      ))}
    </div>
  );
}
