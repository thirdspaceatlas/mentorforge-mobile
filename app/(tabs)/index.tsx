import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { usePlan, Insights, Week } from "@/src/context/PlanContext";
import { Body, Card, Display, Pill, PrimaryButton, ProgressRing, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, statusColor, type } from "@/src/theme/theme";
import { storage } from "@/src/utils/storage";
import {
  cancelReminders,
  ensureLocalPermission,
  registerForPush,
  scheduleStudyReminders,
} from "@/src/services/notifications";
import {
  addSessionToCalendar,
  ensureCalendarPermission,
  freeSlots,
  getBusyPeriods,
  getTodayBusy,
  Slot,
} from "@/src/services/calendar";

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const m = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  if (m(s) === m(e)) return `${s.getDate()}–${e.getDate()} ${m(e)}`;
  return `${s.getDate()} ${m(s)} – ${e.getDate()} ${m(e)}`;
}

type DocketItem = { topic: string; label: string; hours: number; status: "done" | "in_progress" | "pending" };

// Spread a week's sessions across its 7 days, sized to the weekly target,
// then derive per-item completion from the week's logged hours.
function buildDocket(week: Week, fallbackTarget: number): DocketItem[][] {
  const total = week.adjusted_hours || week.planned_hours || fallbackTarget;
  const target = total / 7;
  const days: DocketItem[][] = Array.from({ length: 7 }, () => []);
  const used = new Array(7).fill(0);
  const segs = week.sessions.map((s) => ({ ...s }));
  let di = 0;
  let si = 0;
  while (si < segs.length && di < 7) {
    if (di < 6 && used[di] >= target - 0.05 && days[di].length > 0) {
      di += 1;
      continue;
    }
    const seg = segs[si];
    const capLeft = di === 6 ? Infinity : target - used[di];
    if (seg.hours <= capLeft + 0.05) {
      days[di].push({ topic: seg.topic, label: seg.label, hours: Math.round(seg.hours * 10) / 10, status: "pending" });
      used[di] += seg.hours;
      si += 1;
    } else {
      const part = Math.max(0.5, Math.round(capLeft * 10) / 10);
      days[di].push({ topic: seg.topic, label: seg.label, hours: part, status: "pending" });
      seg.hours = Math.round((seg.hours - part) * 10) / 10;
      used[di] += part;
      di += 1;
    }
  }
  let cum = 0;
  const logged = week.logged_hours;
  for (const day of days) {
    for (const it of day) {
      const start = cum;
      const end = cum + it.hours;
      cum = end;
      it.status = end <= logged + 0.01 ? "done" : start < logged ? "in_progress" : "pending";
    }
  }
  return days;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { plan, refresh, getInsights, syncCalendar: syncCalendarApi } = usePlan();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [coachMsg, setCoachMsg] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const data = await getInsights();
      setInsights(data);
    } catch {
      setInsights(plan?.insights ?? null);
    } finally {
      setInsightsLoading(false);
    }
  }, [getInsights, plan?.insights]);

  useEffect(() => {
    if (plan) loadInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.summary.total_logged_hours, plan?.summary.current_week, plan?.summary.days_to_exam]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    storage.getItem("reminders_on", false).then((v) => setRemindersOn(!!v));
    registerForPush();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    await loadInsights();
    setRefreshing(false);
  }, [refresh, loadInsights]);

  if (!plan) return null;

  const { summary } = plan;
  const currentWeek: Week | undefined =
    plan.weeks.find((w) => w.week_number === summary.current_week) ?? undefined;
  const fb = summary.feasibility;
  const sc = statusColor[fb.grade] ?? statusColor.on_track;
  const firstName = (user?.name || "there").split(" ")[0];
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  let todayItems: DocketItem[] = [];
  let doneCount = 0;
  let dayDate = new Date();
  if (currentWeek) {
    const ws = new Date(currentWeek.start_date);
    const idx = Math.max(0, Math.min(6, Math.floor((Date.now() - ws.getTime()) / 86400000)));
    const days = buildDocket(currentWeek, plan.weekly_hours);
    todayItems = days[idx];
    doneCount = todayItems.filter((i) => i.status === "done").length;
    dayDate = new Date(ws.getTime() + idx * 86400000);
  }

  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayAvail = plan.availability?.find((d) => d.day === todayIdx);
  const todayWindows = todayAvail?.available ? todayAvail.windows : [];

  async function toggleReminders() {
    if (Platform.OS === "web") {
      setCoachMsg("Reminders run in the installed app build.");
      return;
    }
    if (remindersOn) {
      await cancelReminders();
      await storage.setItem("reminders_on", false);
      setRemindersOn(false);
      setCoachMsg("Reminders turned off.");
      return;
    }
    const ok = await ensureLocalPermission();
    if (!ok) {
      setCoachMsg("Enable notifications in Settings to get reminders.");
      return;
    }
    const hour = todayWindows[0] ? parseInt(todayWindows[0].start.split(":")[0], 10) : 18;
    await scheduleStudyReminders(hour, 0);
    await storage.setItem("reminders_on", true);
    setRemindersOn(true);
    setCoachMsg("Daily session reminder + Sunday digest are on.");
  }

  async function syncCalendar() {
    if (Platform.OS === "web") {
      setCoachMsg("Calendar sync runs in the installed app build.");
      return;
    }
    setCoachBusy(true);
    try {
      const ok = await ensureCalendarPermission();
      if (!ok) {
        setCoachMsg("Enable calendar access in Settings to sync.");
        return;
      }
      // Push device busy periods to the shared backend so it regenerates study windows.
      let created = 0;
      try {
        created = await syncCalendarApi(await getBusyPeriods(14));
      } catch {
        // non-blocking; still surface the local free slot below
      }
      const busy = await getTodayBusy();
      const slots = freeSlots(todayWindows, busy);
      const syncedNote = created ? ` Synced ${created} study windows.` : "";
      if (!slots.length) {
        setSlot(null);
        setCoachMsg(`No free study window today inside your availability.${syncedNote}`);
        return;
      }
      setSlot(slots[0]);
      setCoachMsg(`Free study window today: ${fmtTime(slots[0].start)}–${fmtTime(slots[0].end)}.${syncedNote}`);
    } finally {
      setCoachBusy(false);
    }
  }

  async function addToCalendar() {
    if (!slot) return;
    const ok = await addSessionToCalendar(`CFA: ${currentWeek?.focus ?? "Study"}`, slot.start, slot.end);
    setCoachMsg(ok ? "Study session added to your calendar." : "Couldn't add to calendar.");
    setSlot(null);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.greeting}>
            {greeting}, {firstName}
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>
        <Pill label={`${plan.level_label}`} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Readiness narrative */}
        <View style={styles.narrativeBlock}>
          {insightsLoading ? (
            <>
              <View style={[styles.skeleton, { width: "90%" }]} />
              <View style={[styles.skeleton, { width: "75%" }]} />
              <View style={[styles.skeleton, { width: "60%" }]} />
            </>
          ) : (
            <Display testID="readiness-narrative">{insights?.narrative}</Display>
          )}
        </View>

        <View style={styles.statusRow}>
          <Pill label={fb.grade_label} bg={sc.bg} fg={sc.fg} testID="status-pill" />
          <Text style={styles.daysText}>
            {summary.days_to_exam > 0 ? `${summary.days_to_exam} days to exam` : "Exam day has arrived"}
          </Text>
        </View>

        {fb.options && fb.options.length > 0 && (
          <Pressable
            testID="rebalance-banner"
            onPress={() => router.push("/rebalance")}
            style={({ pressed }) => [styles.rebalanceBanner, pressed && { opacity: 0.85 }]}
          >
            <Feather name="alert-triangle" size={16} color={colors.error} />
            <Text style={styles.rebalanceText}>
              {fb.unplaced_hours}h won&apos;t fit before your exam — tap to rebalance honestly.
            </Text>
            <Feather name="chevron-right" size={18} color={colors.error} />
          </Pressable>
        )}

        {/* This week focus card */}
        {currentWeek ? (
          <Card style={{ marginTop: spacing.xl }}>
            <View style={styles.focusHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.overline}>THIS WEEK · WEEK {currentWeek.week_number}</Text>
                <Serif size={type.xxl} style={{ marginTop: spacing.xs }}>
                  {currentWeek.focus}
                </Serif>
                <Body style={{ marginTop: spacing.xs }}>{fmtRange(currentWeek.start_date, currentWeek.end_date)}</Body>
              </View>
              <ProgressRing
                size={68}
                progress={currentWeek.adjusted_hours ? currentWeek.logged_hours / currentWeek.adjusted_hours : 0}
              >
                <Text style={styles.ringText}>
                  {Math.round(
                    (currentWeek.adjusted_hours ? currentWeek.logged_hours / currentWeek.adjusted_hours : 0) * 100,
                  )}
                  %
                </Text>
              </ProgressRing>
            </View>

            <View style={styles.hoursRow}>
              <Text style={styles.hoursLabel}>
                {currentWeek.logged_hours}h logged · {currentWeek.adjusted_hours}h target
              </Text>
            </View>

            <PrimaryButton
              testID="home-log-hours-button"
              title="Log this week's hours"
              onPress={() => router.push(`/week/${currentWeek.week_number}`)}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        ) : summary.not_started ? (
          <Card style={{ marginTop: spacing.xl, alignItems: "center" }} testID="plan-not-started">
            <Feather name="clock" size={28} color={colors.brand} />
            <Serif size={type.xl} style={{ marginTop: spacing.md }}>
              Your plan starts soon
            </Serif>
            <Body style={{ textAlign: "center", marginTop: spacing.xs }}>
              {summary.starts_on
                ? `Week 1 begins ${new Date(summary.starts_on).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}. Get a head start by syncing your calendar below.`
                : "Sync your calendar below to line up your first study window."}
            </Body>
          </Card>
        ) : (
          <Card style={{ marginTop: spacing.xl, alignItems: "center" }}>
            <Feather name="check-circle" size={28} color={colors.brand} />
            <Serif size={type.xl} style={{ marginTop: spacing.md }}>
              Every week is complete
            </Serif>
            <Body style={{ textAlign: "center", marginTop: spacing.xs }}>
              You&apos;ve worked through the whole plan. Spend remaining time on mocks and weak areas.
            </Body>
          </Card>
        )}

        {/* Today's Docket */}
        {currentWeek && (
          <View style={styles.docketCard} testID="todays-docket">
            <View style={styles.docketHead}>
              <View>
                <Text style={styles.overline}>{"TODAY'S DOCKET"}</Text>
                <Serif size={type.lg} style={{ marginTop: 2 }}>
                  {dayDate.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}
                </Serif>
              </View>
              <Text style={styles.docketMeta}>
                {todayItems.length} {todayItems.length === 1 ? "session" : "sessions"} · {doneCount} done
              </Text>
            </View>
            {todayItems.length === 0 ? (
              <Body style={{ marginTop: spacing.md }}>No sessions scheduled today. Enjoy the rest.</Body>
            ) : (
              <View style={{ marginTop: spacing.lg, gap: spacing.lg }}>
                {todayItems.map((it, i) => (
                  <View key={i} style={styles.docketItem} testID={`docket-item-${i}`}>
                    {it.status === "done" ? (
                      <Feather name="check" size={16} color={colors.success} style={styles.glyphIcon} />
                    ) : (
                      <Text
                        style={[
                          styles.glyph,
                          { color: it.status === "in_progress" ? colors.brand : colors.muted },
                        ]}
                      >
                        {it.status === "in_progress" ? "◆" : "◇"}
                      </Text>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionTopic, it.status === "done" && styles.doneText]}>{it.topic}</Text>
                      <Text style={styles.sessionLabel}>{it.label}</Text>
                    </View>
                    <Text style={styles.sessionHours}>{it.hours}h</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat value={`${summary.completed_weeks}/${summary.total_weeks}`} label="Weeks done" />
          <View style={styles.statDivider} />
          <Stat value={`${summary.total_logged_hours}h`} label="Hours logged" />
          <View style={styles.statDivider} />
          <Stat value={`${summary.progress_pct}%`} label="Complete" />
        </View>

        {/* AI tip */}
        <View style={styles.tipCard}>
          <View style={styles.tipHead}>
            <Feather name="compass" size={16} color={colors.brand} />
            <Text style={styles.tipTitle}>Calendar Coach</Text>
          </View>
          {insightsLoading ? (
            <ActivityIndicator color={colors.brand} style={{ alignSelf: "flex-start", marginTop: spacing.sm }} />
          ) : (
            <Text style={styles.tipText} testID="coach-tip">
              {insights?.tip}
            </Text>
          )}
        </View>
        {/* Calendar & reminders */}
        <View style={styles.coachCard} testID="calendar-coach-card">
          <View style={styles.tipHead}>
            <Feather name="calendar" size={16} color={colors.brand} />
            <Text style={styles.tipTitle}>CALENDAR & REMINDERS</Text>
          </View>
          <View style={styles.coachBtnRow}>
            <Pressable testID="sync-calendar-btn" onPress={syncCalendar} style={styles.coachBtn}>
              <Feather name="refresh-cw" size={14} color={colors.onSurface} />
              <Text style={styles.coachBtnText}>{coachBusy ? "Syncing…" : "Sync calendar"}</Text>
            </Pressable>
            <Pressable
              testID="reminders-toggle-btn"
              onPress={toggleReminders}
              style={[styles.coachBtn, remindersOn && styles.coachBtnOn]}
            >
              <Feather name="bell" size={14} color={remindersOn ? colors.onBrandPrimary : colors.onSurface} />
              <Text style={[styles.coachBtnText, remindersOn && { color: colors.onBrandPrimary }]}>
                {remindersOn ? "Reminders on" : "Reminders"}
              </Text>
            </Pressable>
          </View>
          {coachMsg && (
            <Text style={styles.coachMsg} testID="coach-msg">
              {coachMsg}
            </Text>
          )}
          <Pressable
            testID="view-sessions-btn"
            onPress={() => router.push("/sessions")}
            style={({ pressed }) => [styles.sessionsLink, pressed && { opacity: 0.7 }]}
          >
            <Feather name="clock" size={14} color={colors.brand} />
            <Text style={styles.sessionsLinkText}>View study sessions</Text>
            <Feather name="chevron-right" size={16} color={colors.brand} />
          </Pressable>
          {slot && (
            <PrimaryButton
              testID="add-to-calendar-btn"
              title="Add session to calendar"
              variant="outline"
              onPress={addToCalendar}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Serif size={type.xl}>{value}</Serif>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  greeting: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.lg },
  date: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginTop: 2 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  narrativeBlock: { minHeight: 60 },
  skeleton: {
    height: 22,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    marginBottom: spacing.sm,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  rebalanceBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#F3E7E7",
  },
  rebalanceText: { flex: 1, fontFamily: fonts.sansMedium, color: colors.error, fontSize: type.base },
  daysText: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.base },
  focusHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  overline: { fontFamily: fonts.sansMedium, color: colors.muted, fontSize: type.sm, letterSpacing: 1.2 },
  ringText: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.base },
  hoursRow: { marginTop: spacing.md },
  hoursLabel: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.base },
  docket: { marginTop: spacing.lg, gap: spacing.md },
  docketCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  docketHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  docketMeta: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginTop: 2 },
  docketItem: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  glyph: { fontSize: 16, width: 16, textAlign: "center", marginTop: 1 },
  glyphIcon: { width: 16, textAlign: "center", marginTop: 1 },
  doneText: { textDecorationLine: "line-through", color: colors.muted },
  session: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  sessionTopic: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.base },
  sessionLabel: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginTop: 1 },
  sessionHours: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.base },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
  },
  stat: { flex: 1, alignItems: "center" },
  statLabel: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.divider },
  tipCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.brandSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tipHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tipTitle: { fontFamily: fonts.sansMedium, color: colors.onBrandSecondary, fontSize: type.sm, letterSpacing: 0.5 },
  tipText: {
    fontFamily: fonts.sans,
    color: colors.onBrandSecondary,
    fontSize: type.base,
    lineHeight: type.base * 1.5,
    marginTop: spacing.sm,
  },
  coachCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  coachBtnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  coachBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  coachBtnOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  coachBtnText: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.base },
  coachMsg: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.sm, marginTop: spacing.md },
  sessionsLink: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.lg },
  sessionsLinkText: { flex: 1, fontFamily: fonts.sansMedium, color: colors.brand, fontSize: type.base },
});
