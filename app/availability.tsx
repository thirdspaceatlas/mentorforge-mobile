import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { usePlan, AvailDay, AvailWindow, Guardrails } from "@/src/context/PlanContext";
import { Body, PrimaryButton, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, type } from "@/src/theme/theme";

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
};
const iso = (min: number) => `${Math.floor(min / 60).toString().padStart(2, "0")}:${(min % 60).toString().padStart(2, "0")}`;
const winHours = (w: AvailWindow) => Math.max(0, (toMin(w.end) - toMin(w.start)) / 60);

export default function Availability() {
  const insets = useSafeAreaInsets();
  const { plan, updateAvailability } = usePlan();
  const [days, setDays] = useState<AvailDay[]>(() =>
    plan
      ? plan.availability.map((d) => ({
          ...d,
          windows: d.windows && d.windows.length ? d.windows.map((w) => ({ ...w })) : [{ start: "18:00", end: "21:00" }],
        }))
      : [],
  );
  const [g, setG] = useState<Guardrails>(() =>
    plan ? { ...plan.guardrails } : { max_daily_hours: 4, max_weekly_hours: 20, min_session_minutes: 25 },
  );
  const [saving, setSaving] = useState(false);

  const weeklyCapacity = useMemo(() => {
    const daySum = days
      .filter((d) => d.available)
      .reduce((s, d) => s + Math.min(d.windows.reduce((a, w) => a + winHours(w), 0), g.max_daily_hours), 0);
    return Math.round(Math.min(daySum, g.max_weekly_hours) * 10) / 10;
  }, [days, g]);

  if (!plan) return null;

  function patchWindow(di: number, wi: number, field: "start" | "end", deltaMin: number) {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== di) return d;
        const windows = d.windows.map((w, j) => {
          if (j !== wi) return w;
          let val = toMin(w[field]) + deltaMin;
          val = Math.max(300, Math.min(1350, val)); // 5:00 AM – 10:30 PM
          const next = { ...w, [field]: iso(val) };
          if (toMin(next.end) - toMin(next.start) < 30) return w; // keep >= 30m
          return next;
        });
        return { ...d, windows };
      }),
    );
  }

  function addWindow(di: number) {
    setDays((prev) => prev.map((d, i) => (i === di ? { ...d, windows: [...d.windows, { start: "07:00", end: "09:00" }] } : d)));
  }
  function removeWindow(di: number, wi: number) {
    setDays((prev) => prev.map((d, i) => (i === di ? { ...d, windows: d.windows.filter((_, j) => j !== wi) } : d)));
  }
  function toggleDay(di: number, v: boolean) {
    setDays((prev) => prev.map((d, i) => (i === di ? { ...d, available: v } : d)));
  }

  async function save() {
    setSaving(true);
    try {
      await updateAvailability(days, g);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="availability-back" onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Availability & pacing</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.capCard}>
          <Text style={styles.capLabel}>WEEKLY CAPACITY</Text>
          <Serif size={30} style={{ marginTop: 2 }}>{weeklyCapacity}h / week</Serif>
          <Body style={{ marginTop: spacing.xs }}>
            Your study windows feed the rebalancer now, and the Calendar Coach later.
          </Body>
        </View>

        <Text style={styles.sectionLabel}>YOUR STUDY WINDOWS</Text>
        {days.map((d, di) => (
          <View key={d.day} style={styles.dayBlock} testID={`avail-day-${d.day}`}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayLabel, !d.available && { color: colors.muted }]}>{d.label}</Text>
              <Switch
                value={d.available}
                onValueChange={(v) => toggleDay(di, v)}
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.surfaceSecondary}
              />
            </View>
            {d.available &&
              d.windows.map((w, wi) => (
                <View key={wi} style={styles.window}>
                  <TimeStepper label="From" value={w.start} onStep={(delta) => patchWindow(di, wi, "start", delta)} testID={`win-${d.day}-${wi}-start`} />
                  <TimeStepper label="To" value={w.end} onStep={(delta) => patchWindow(di, wi, "end", delta)} testID={`win-${d.day}-${wi}-end`} />
                  <Pressable testID={`win-remove-${d.day}-${wi}`} onPress={() => removeWindow(di, wi)} hitSlop={8} style={styles.removeBtn}>
                    <Feather name="x" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            {d.available && (
              <Pressable testID={`win-add-${d.day}`} onPress={() => addWindow(di)} style={styles.addWindow}>
                <Feather name="plus" size={14} color={colors.brand} />
                <Text style={styles.addText}>Add window</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Text style={styles.sectionLabel}>GUARDRAILS</Text>
        <GuardrailRow label="Max hours / day" value={g.max_daily_hours} onChange={(v) => setG((p) => ({ ...p, max_daily_hours: v }))} min={1} max={10} testID="guard-daily" />
        <GuardrailRow label="Max hours / week" value={g.max_weekly_hours} onChange={(v) => setG((p) => ({ ...p, max_weekly_hours: v }))} min={4} max={60} step={1} testID="guard-weekly" />
        <Body style={{ marginTop: spacing.md }}>
          Guardrails stop the rebalancer from silently stacking impossible weeks. If load won&apos;t fit,
          you&apos;ll be offered honest tradeoffs instead.
        </Body>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton testID="availability-save" title="Save & rebalance" onPress={save} loading={saving} />
      </View>
    </View>
  );
}

function TimeStepper({ label, value, onStep, testID }: { label: string; value: string; onStep: (d: number) => void; testID: string }) {
  return (
    <View style={styles.timeStepper} testID={testID}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeRow}>
        <Pressable testID={`${testID}-dec`} onPress={() => onStep(-30)} style={styles.timeBtn}>
          <Feather name="minus" size={14} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.timeVal}>{fmt(toMin(value))}</Text>
        <Pressable testID={`${testID}-inc`} onPress={() => onStep(30)} style={styles.timeBtn}>
          <Feather name="plus" size={14} color={colors.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

function GuardrailRow({ label, value, onChange, min, max, step = 0.5, testID }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; testID: string }) {
  return (
    <View style={styles.guardRow} testID={testID}>
      <Text style={styles.dayLabel}>{label}</Text>
      <View style={styles.timeRow}>
        <Pressable testID={`${testID}-dec`} onPress={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))} style={styles.timeBtn}>
          <Feather name="minus" size={14} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.timeVal}>{value}h</Text>
        <Pressable testID={`${testID}-inc`} onPress={() => onChange(Math.min(max, Math.round((value + step) * 10) / 10))} style={styles.timeBtn}>
          <Feather name="plus" size={14} color={colors.onSurface} />
        </Pressable>
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.lg },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  capCard: { backgroundColor: colors.brandSecondary, borderRadius: radius.lg, padding: spacing.xl },
  capLabel: { fontFamily: fonts.sansMedium, color: colors.onBrandSecondary, fontSize: type.sm, letterSpacing: 1.4 },
  sectionLabel: { fontFamily: fonts.sansMedium, color: colors.muted, fontSize: type.sm, letterSpacing: 1.4, marginTop: spacing.xl, marginBottom: spacing.sm },
  dayBlock: { borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: spacing.md },
  dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayLabel: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.lg, flex: 1 },
  window: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.md },
  timeStepper: { flex: 1 },
  timeLabel: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginBottom: 4 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  timeBtn: { width: 32, height: 32, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  timeVal: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.base, minWidth: 74, textAlign: "center" },
  removeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginBottom: 0 },
  addWindow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  addText: { fontFamily: fonts.sansMedium, color: colors.brand, fontSize: type.base },
  guardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
