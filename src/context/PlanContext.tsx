import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

import { api, ApiError } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

export type Session = { topic: string; code: string; hours: number; label: string };
export type Week = {
  week_number: number;
  start_date: string;
  end_date: string;
  planned_hours: number;
  adjusted_hours: number;
  logged_hours: number;
  completed: boolean;
  focus: string;
  is_review: boolean;
  sessions: Session[];
};
export type Summary = {
  total_weeks: number;
  completed_weeks: number;
  total_planned_hours: number;
  total_logged_hours: number;
  pace_hours: number;
  status: "ahead" | "on_track" | "behind";
  days_to_exam: number;
  current_week: number | null;
  current_focus: string;
  progress_pct: number;
  not_started: boolean;
  starts_on: string | null;
  feasibility: Feasibility;
};
export type Plan = {
  id: string;
  level: "I" | "II" | "III";
  level_label: string;
  exam_date: string;
  start_date: string;
  weekly_hours: number;
  weeks: Week[];
  availability: AvailDay[];
  guardrails: Guardrails;
  off_hours: number;
  summary: Summary;
  insights: { narrative: string; tip: string } | null;
};
export type Insights = { narrative: string; tip: string };

export type Feasibility = {
  grade: "on_track" | "tight" | "at_risk";
  grade_label: string;
  weekly_capacity_hours: number;
  unplaced_hours: number;
  accepted_gap: boolean;
  event_id: string | null;
  message: string | null;
  // Resolution keys offered by the shared backend, e.g.
  // ["extend-exam-window","raise-capacity","reduce-scope","accept-gap"].
  options: string[] | null;
};
export type AvailWindow = { start: string; end: string };
export type AvailDay = { day: number; label: string; available: boolean; windows: AvailWindow[] };
export type Guardrails = { max_daily_hours: number; max_weekly_hours: number; min_session_minutes: number };

// ---- Shared-backend (Next.js + Supabase) raw response shapes ----
type RawWeek = {
  week: number;
  topic: string;
  startDate: string;
  endDate: string;
  plannedHours: number;
  rebalancedExtraHours?: number;
  daysInWeek?: number;
};
type RawPlan = {
  examLevel: "I" | "II" | "III";
  examDate: string;
  weeklyHours: number;
  planStartDate: string;
  weekStartDay?: string;
  levelIIIPathway?: string | null;
  forecastDays?: number;
  calendarPreferredSessionMin?: number;
  dayStartHour?: number;
  dayEndHour?: number;
  weekPlan: RawWeek[];
  baseWeekPlan?: RawWeek[];
  actualHours?: (number | null)[];
};
type RawStats = {
  minutesToday: number;
  pacePercent: number;
  daysToExam: number;
  calendarsConnected: number;
  studyPlanSummary?: { examLevel: string; examDate: string; weeklyHours: number; weekCount: number };
  todayWindows?: unknown[];
  nextWindow?: { startTime: string; durationMin: number } | null;
  heatmap?: { date: string; minutes: number }[];
};
type RawInfeasEvent = {
  id: string;
  unplaceableMinutes: number;
  message: string;
  optionsOffered: string;
  grade: string;
  resolvedAt: string | null;
  resolvedFeasible: boolean;
};

const LEVEL_LABEL: Record<string, string> = { I: "Level I", II: "Level II", III: "Level III" };
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().slice(0, 10);

function gradeInfo(grade: string): { grade: Feasibility["grade"]; label: string } {
  switch (grade) {
    case "at-risk":
    case "at_risk":
      return { grade: "at_risk", label: "At risk" };
    case "tight":
      return { grade: "tight", label: "Tight" };
    default:
      return { grade: "on_track", label: "On track" };
  }
}

function mapPlan(raw: RawPlan, stats: RawStats | null, events: RawInfeasEvent[]): Plan {
  const actual = raw.actualHours ?? [];
  const weeks: Week[] = raw.weekPlan.map((w, i) => {
    const adjusted = w.plannedHours + (w.rebalancedExtraHours ?? 0);
    const raw_logged = actual[i];
    const logged = raw_logged ?? 0;
    return {
      week_number: w.week,
      start_date: w.startDate,
      end_date: w.endDate,
      planned_hours: w.plannedHours,
      adjusted_hours: adjusted,
      logged_hours: logged,
      completed: raw_logged != null && adjusted > 0 && logged >= adjusted,
      focus: w.topic,
      is_review: /review|mock|exam/i.test(w.topic),
      sessions: [
        { topic: w.topic, code: "", hours: adjusted, label: `${w.daysInWeek ?? 7}-day focus block` },
      ],
    };
  });

  const today = todayStr();
  const current = weeks.find((w) => today >= w.start_date && today <= w.end_date);
  const current_week = current?.week_number ?? null;
  const firstStart = weeks[0]?.start_date ?? null;
  const not_started = !!firstStart && today < firstStart;

  const total_planned = weeks.reduce((s, w) => s + w.adjusted_hours, 0);
  const total_logged = weeks.reduce((s, w) => s + w.logged_hours, 0);
  const completed_weeks = weeks.filter((w) => w.completed).length;
  const progress_pct = total_planned > 0 ? Math.round((total_logged / total_planned) * 100) : 0;

  const pace = stats?.pacePercent ?? 100;
  const status: Summary["status"] = pace >= 105 ? "ahead" : pace < 90 ? "behind" : "on_track";

  const unresolved = events.find((e) => !e.resolvedAt);
  const gi = gradeInfo(unresolved?.grade ?? "on_track");
  const feasibility: Feasibility = {
    grade: gi.grade,
    grade_label: gi.label,
    weekly_capacity_hours: raw.weeklyHours,
    unplaced_hours: unresolved ? Math.round((unresolved.unplaceableMinutes / 60) * 10) / 10 : 0,
    accepted_gap: false,
    event_id: unresolved?.id ?? null,
    message: unresolved?.message ?? null,
    options: unresolved
      ? unresolved.optionsOffered.split(",").map((s) => s.trim()).filter(Boolean)
      : null,
  };

  const summary: Summary = {
    total_weeks: weeks.length,
    completed_weeks,
    total_planned_hours: Math.round(total_planned * 10) / 10,
    total_logged_hours: Math.round(total_logged * 10) / 10,
    pace_hours: 0,
    status,
    days_to_exam: stats?.daysToExam ?? 0,
    current_week,
    current_focus: current?.focus ?? "",
    progress_pct,
    not_started,
    starts_on: firstStart,
    feasibility,
  };

  const dayStart = raw.dayStartHour ?? 7;
  const dayEnd = raw.dayEndHour ?? 22;
  const availability: AvailDay[] = DAY_LABELS.map((label, i) => ({
    day: i,
    label,
    available: true,
    windows: [{ start: `${pad(dayStart)}:00`, end: `${pad(dayEnd)}:00` }],
  }));
  const guardrails: Guardrails = {
    max_daily_hours: Math.max(2, Math.ceil(raw.weeklyHours / 4)),
    max_weekly_hours: Math.max(raw.weeklyHours, raw.weeklyHours * 2),
    min_session_minutes: raw.calendarPreferredSessionMin ?? 25,
  };

  return {
    id: "shared",
    level: raw.examLevel,
    level_label: LEVEL_LABEL[raw.examLevel] ?? "CFA Plan",
    exam_date: raw.examDate,
    start_date: raw.planStartDate,
    weekly_hours: raw.weeklyHours,
    weeks,
    availability,
    guardrails,
    off_hours: 0,
    summary,
    insights: null,
  };
}

function localInsights(plan: Plan, stats: RawStats | null): Insights {
  const s = plan.summary;
  const paceWord = s.status === "ahead" ? "ahead of pace" : s.status === "behind" ? "behind pace" : "on pace";
  const narrative =
    s.days_to_exam > 0
      ? `${s.days_to_exam} days to your ${plan.level_label} exam. You've logged ${s.total_logged_hours}h of ${s.total_planned_hours}h across ${s.total_weeks} weeks — you're ${paceWord}.`
      : `Your ${plan.level_label} exam window has arrived. Finish strong with mocks and your weakest topics.`;
  let tip: string;
  if (stats?.nextWindow) {
    const t = new Date(stats.nextWindow.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    tip = `Your next study window is at ${t} for ${stats.nextWindow.durationMin} min. Protect it — small consistent blocks beat cramming.`;
  } else if (s.current_focus) {
    tip = `This week is ${s.current_focus}. Sync your calendar to slot a focused session into a free window today.`;
  } else {
    tip = `Keep a steady rhythm — sync your calendar to find a free study window today.`;
  }
  return { narrative, tip };
}

export type CalWindow = {
  id: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  topicName: string | null;
  studyType: string | null;
  status: "done" | "current" | "upcoming" | "missed" | string;
  session: { id: string; status?: string } | null;
};

type PlanState = {
  plan: Plan | null;
  loading: boolean;
  fetched: boolean;
  refresh: () => Promise<void>;
  createPlan: (body: {
    level: string;
    exam_date: string;
    start_date: string;
    weekly_hours: number;
  }) => Promise<Plan>;
  logWeek: (weekNumber: number, loggedHours: number, completed: boolean, offHours?: number) => Promise<void>;
  updateAvailability: (availability: AvailDay[], guardrails: Guardrails) => Promise<void>;
  resolveInfeasible: (resolution: string, extra?: Record<string, unknown>) => Promise<void>;
  syncCalendar: (busyPeriods: { start: string; end: string }[]) => Promise<number>;
  getWindows: () => Promise<CalWindow[]>;
  startSession: (windowId: string, plannedDurationMin?: number) => Promise<void>;
  endSession: (sessionId: string, action: "complete" | "interrupt") => Promise<void>;
  resetPlan: () => Promise<void>;
  getInsights: () => Promise<Insights>;
};

const PlanContext = createContext<PlanState | undefined>(undefined);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const rawRef = useRef<RawPlan | null>(null);
  const statsRef = useRef<RawStats | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [planRes, stats, infeas] = await Promise.all([
        api<{ plan: RawPlan | null }>("/study-plan").catch(() => null),
        api<RawStats>("/calendar/stats").catch(() => null),
        api<{ events: RawInfeasEvent[] }>("/plan/infeasibility").catch(() => ({ events: [] })),
      ]);
      // A failed /study-plan (e.g. transient network / token refresh) keeps the
      // last good plan rather than bouncing the user to onboarding.
      if (planRes === null) return;
      rawRef.current = planRes.plan;
      statsRef.current = stats;
      if (planRes.plan && planRes.plan.weekPlan?.length) {
        setPlan(mapPlan(planRes.plan, stats, infeas.events ?? []));
      } else {
        setPlan(null);
      }
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      refresh();
    } else {
      setPlan(null);
      setFetched(false);
      rawRef.current = null;
    }
  }, [session, refresh]);

  const logWeek = useCallback(
    async (weekNumber: number, loggedHours: number, completed: boolean, offHours = 0) => {
      const raw = rawRef.current;
      if (!raw) throw new ApiError("No plan loaded yet.", 400);
      const actual = [...(raw.actualHours ?? raw.weekPlan.map(() => null as number | null))];
      const idx = weekNumber - 1;
      if (idx < 0 || idx >= actual.length) throw new ApiError("Week out of range.", 400);
      const wk = raw.weekPlan[idx];
      const target = wk.plannedHours + (wk.rebalancedExtraHours ?? 0);
      let total = loggedHours + offHours;
      // "Mark week complete" means it counts as done: never log below the week's target.
      if (completed && total < target) total = target;
      actual[idx] = Math.round(total * 10) / 10;
      const next: RawPlan = { ...raw, actualHours: actual };
      await api("/study-plan", { method: "PUT", body: next });
      // Recompute feasibility on the shared backend so the rebalancer can surface
      // an honest tradeoff if this change pushed the plan out of reach.
      await api("/plan/infeasibility", { method: "POST", body: {} }).catch(() => null);
      await refresh();
    },
    [refresh],
  );

  // Availability is synthesized from the shared plan's session-hour window for now;
  // persisting custom weekly windows needs the shared-backend windows contract (Phase 6).
  const updateAvailability = useCallback(async (availability: AvailDay[], guardrails: Guardrails) => {
    setPlan((prev) => (prev ? { ...prev, availability, guardrails } : prev));
  }, []);

  const createPlan = useCallback(
    async (body: { level: string; exam_date: string; start_date: string; weekly_hours: number }): Promise<Plan> => {
      const res = await api<{ plan: RawPlan }>("/study-plan/generate", {
        method: "POST",
        body: {
          examLevel: body.level,
          examDate: body.exam_date,
          planStartDate: body.start_date,
          weeklyHours: body.weekly_hours,
          weekStartDay: "1",
          dayStartHour: 7,
          dayEndHour: 22,
          calendarPreferredSessionMin: 45,
        },
      });
      rawRef.current = res.plan;
      const mapped = mapPlan(res.plan, statsRef.current, []);
      setPlan(mapped);
      // Fire-and-refresh so stats/windows catch up to the freshly generated plan.
      refresh();
      return mapped;
    },
    [refresh],
  );

  const resolveInfeasible = useCallback(
    async (resolution: string, extra: Record<string, unknown> = {}) => {
      const eventId = plan?.summary.feasibility.event_id ?? null;
      if (!eventId) throw new ApiError("Nothing to rebalance right now.", 400);
      await api("/plan/infeasibility", { method: "PATCH", body: { eventId, resolution, ...extra } });
      await refresh();
    },
    [plan, refresh],
  );

  const syncCalendar = useCallback(async (busyPeriods: { start: string; end: string }[]) => {
    const res = await api<{ results?: { windowsCreated?: number } }>("/calendar/sync", {
      method: "POST",
      body: { busyPeriods },
    });
    return res.results?.windowsCreated ?? 0;
  }, []);

  const getWindows = useCallback(async () => {
    const res = await api<{ windows: CalWindow[] }>("/calendar/windows");
    return res.windows ?? [];
  }, []);

  const startSession = useCallback(async (windowId: string, plannedDurationMin?: number) => {
    await api("/calendar/sessions", {
      method: "POST",
      body: plannedDurationMin ? { windowId, plannedDurationMin } : { windowId },
    });
  }, []);

  const endSession = useCallback(async (sessionId: string, action: "complete" | "interrupt") => {
    await api("/calendar/sessions", { method: "PATCH", body: { sessionId, action } });
  }, []);

  // "Rebuild plan" clears the local plan and sends the user back through onboarding,
  // which regenerates + overwrites their saved plan via /study-plan/generate.
  const resetPlan = useCallback(async () => {
    setPlan(null);
    rawRef.current = null;
  }, []);

  const getInsights = useCallback(async (): Promise<Insights> => {
    try {
      const data = await api<{ readiness?: string; coachTip?: string }>("/insights");
      if (data.readiness || data.coachTip) {
        return { narrative: data.readiness ?? "", tip: data.coachTip ?? "" };
      }
    } catch {
      // fall through to local insights
    }
    if (plan) return localInsights(plan, statsRef.current);
    return { narrative: "", tip: "" };
  }, [plan]);

  return (
    <PlanContext.Provider
      value={{ plan, loading, fetched, refresh, createPlan, logWeek, updateAvailability, resolveInfeasible, syncCalendar, getWindows, startSession, endSession, resetPlan, getInsights }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
