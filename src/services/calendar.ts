// Device-calendar sync ("Calendar Coach" gap-finder). Native-only.
import { Platform } from "react-native";
import * as Calendar from "expo-calendar";

export type Busy = { start: Date; end: Date; title: string };
export type Slot = { start: Date; end: Date };
export type Win = { start: string; end: string };

export async function ensureCalendarPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const cur = await Calendar.getCalendarPermissionsAsync();
  if (cur.status === "granted") return true;
  if (!cur.canAskAgain) return false;
  const req = await Calendar.requestCalendarPermissionsAsync();
  return req.status === "granted";
}

export async function getTodayBusy(): Promise<Busy[]> {
  if (Platform.OS === "web") return [];
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (!cals.length) return [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const events = await Calendar.getEventsAsync(cals.map((c) => c.id), start, end);
  return events
    .filter((e) => !e.allDay)
    .map((e) => ({ start: new Date(e.startDate), end: new Date(e.endDate), title: e.title || "Busy" }));
}

/** Device busy periods across the next `days` days, as ISO {start,end} for /calendar/sync. */
export async function getBusyPeriods(days = 14): Promise<{ start: string; end: string }[]> {
  if (Platform.OS === "web") return [];
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (!cals.length) return [];
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  const events = await Calendar.getEventsAsync(cals.map((c) => c.id), start, end);
  return events
    .filter((e) => !e.allDay)
    .map((e) => ({ start: new Date(e.startDate).toISOString(), end: new Date(e.endDate).toISOString() }));
}

/** Subtract busy blocks from today's availability windows → free study slots. */
export function freeSlots(windows: Win[], busy: Busy[], base = new Date()): Slot[] {
  const toDate = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  };
  let free: Slot[] = windows.map((w) => ({ start: toDate(w.start), end: toDate(w.end) }));
  for (const b of busy) {
    const next: Slot[] = [];
    for (const f of free) {
      if (b.end <= f.start || b.start >= f.end) {
        next.push(f);
        continue;
      }
      if (b.start > f.start) next.push({ start: f.start, end: new Date(Math.min(+b.start, +f.end)) });
      if (b.end < f.end) next.push({ start: new Date(Math.max(+b.end, +f.start)), end: f.end });
    }
    free = next;
  }
  return free.filter((f) => +f.end - +f.start >= 15 * 60000);
}

async function writableCalendarId(): Promise<string | null> {
  if (Platform.OS === "ios") {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.id) return def.id;
    } catch {
      // fall through
    }
  }
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const w = cals.find((c) => c.allowsModifications);
  return w?.id ?? null;
}

export async function addSessionToCalendar(title: string, start: Date, end: Date): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const id = await writableCalendarId();
  if (!id) return false;
  await Calendar.createEventAsync(id, {
    title,
    startDate: start,
    endDate: end,
    notes: "MentorForge study session",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return true;
}
