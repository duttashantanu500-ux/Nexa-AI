export type ScheduleCadence = "once" | "daily" | "weekly" | "monthly";

export interface ScheduleConfig {
  cadence: ScheduleCadence;
  /** 0-6 for weekly (0=Sun), 1-28 for monthly day */
  dayOfWeek?: number;
  dayOfMonth?: number;
  hourUTC?: number;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

export function computeNextRun(
  cadence: ScheduleCadence,
  from = new Date(),
  opts?: { dayOfWeek?: number; dayOfMonth?: number; hourUTC?: number }
): string {
  const hour = opts?.hourUTC ?? 9;
  const d = new Date(from.getTime());
  d.setUTCMinutes(0, 0, 0);

  if (cadence === "once") {
    d.setUTCHours(hour);
    if (d <= from) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }

  if (cadence === "daily") {
    d.setUTCHours(hour);
    if (d <= from) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }

  if (cadence === "weekly") {
    const target = opts?.dayOfWeek ?? 1; // Monday
    d.setUTCHours(hour);
    const delta = (target - d.getUTCDay() + 7) % 7;
    d.setUTCDate(d.getUTCDate() + (delta === 0 && d <= from ? 7 : delta || 7));
    if (d <= from) d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString();
  }

  // monthly
  const day = Math.min(opts?.dayOfMonth ?? 1, 28);
  d.setUTCHours(hour);
  d.setUTCDate(day);
  if (d <= from) {
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(day);
  }
  return d.toISOString();
}

export function isDue(nextRunAt?: string, now = new Date()): boolean {
  if (!nextRunAt) return false;
  return new Date(nextRunAt).getTime() <= now.getTime();
}
