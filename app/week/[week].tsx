import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

import { usePlan } from "@/src/context/PlanContext";
import { ApiError } from "@/src/api/client";
import { Body, PrimaryButton, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, type } from "@/src/theme/theme";

function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const m = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  if (m(s) === m(e)) return `${s.getDate()}–${e.getDate()} ${m(e)}`;
  return `${s.getDate()} ${m(s)} – ${e.getDate()} ${m(e)}`;
}

export default function LogWeek() {
  const insets = useSafeAreaInsets();
  const { week: weekParam } = useLocalSearchParams<{ week: string }>();
  const { plan, logWeek } = usePlan();
  const weekNumber = Number(weekParam);
  const week = plan?.weeks.find((w) => w.week_number === weekNumber);

  const [hours, setHours] = useState(week ? String(week.logged_hours || "") : "");
  const [completed, setCompleted] = useState(week?.completed ?? false);
  const [offHours, setOffHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plan || !week) {
    return (
      <View style={styles.root}>
        <Body style={{ padding: spacing.xl }}>Week not found.</Body>
      </View>
    );
  }

  async function save() {
    setError(null);
    const value = parseFloat(hours || "0");
    if (isNaN(value) || value < 0) {
      setError("Enter a valid number of hours.");
      return;
    }
    setSaving(true);
    try {
      await logWeek(weekNumber, value, completed, parseFloat(offHours || "0"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="log-close" onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Week {week.week_number}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={90}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.overline}>{fmtRange(week.start_date, week.end_date)}</Text>
        <Serif size={type.xxl} style={{ marginTop: spacing.xs }}>
          {week.focus}
        </Serif>

        <View style={styles.sessions}>
          {week.sessions.map((s, i) => (
            <View key={i} style={styles.session}>
              <Feather name="bookmark" size={14} color={colors.brand} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTopic}>{s.topic}</Text>
                <Text style={styles.sessionLabel}>{s.label}</Text>
              </View>
              <Text style={styles.sessionHours}>{s.hours}h</Text>
            </View>
          ))}
        </View>

        <View style={styles.inputBlock}>
          <Text style={styles.inputLabel}>Hours studied this week</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="log-hours-input"
              value={hours}
              onChangeText={setHours}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.border}
              style={styles.hoursInput}
            />
            <Text style={styles.hoursUnit}>hrs</Text>
          </View>
          <Text style={styles.target}>Target this week: {week.adjusted_hours}h</Text>
        </View>

        <Pressable
          testID="mark-complete-toggle"
          style={styles.completeRow}
          onPress={() => setCompleted((c) => !c)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.completeLabel}>Mark week complete</Text>
            <Body>Completing locks the week and rolls any gap forward.</Body>
          </View>
          <Switch
            value={completed}
            onValueChange={setCompleted}
            trackColor={{ true: colors.brand, false: colors.border }}
            thumbColor={colors.surfaceSecondary}
          />
        </Pressable>

        <View style={styles.offRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.completeLabel}>Off-plan hours (optional)</Text>
            <Body>Studied outside the plan? Add it so catch-up counts.</Body>
          </View>
          <TextInput
            testID="off-hours-input"
            value={offHours}
            onChangeText={setOffHours}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.border}
            style={styles.offInput}
          />
        </View>

        <View style={styles.note}>
          <Feather name="info" size={15} color={colors.brand} />
          <Body style={{ flex: 1 }}>
            Logging fewer hours than your target? The missed load automatically rolls forward into your
            remaining weeks, so your runway stays honest.
          </Body>
        </View>

        {error && (
          <Text style={styles.error} testID="log-error">
            {error}
          </Text>
        )}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <PrimaryButton testID="log-save-button" title="Save & rebalance" onPress={save} loading={saving} />
        </View>
      </KeyboardStickyView>
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
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  overline: { fontFamily: fonts.sansMedium, color: colors.muted, fontSize: type.sm, letterSpacing: 1.2 },
  sessions: { marginTop: spacing.xl, gap: spacing.md },
  session: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  sessionTopic: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.base },
  sessionLabel: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginTop: 1 },
  sessionHours: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.base },
  inputBlock: {
    marginTop: spacing.xxl,
    alignItems: "center",
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  inputLabel: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.base },
  inputRow: { flexDirection: "row", alignItems: "flex-end", marginTop: spacing.sm },
  hoursInput: {
    fontFamily: fonts.serifMedium,
    fontSize: 64,
    color: colors.onSurface,
    minWidth: 90,
    textAlign: "center",
    padding: 0,
  },
  hoursUnit: {
    fontFamily: fonts.sans,
    fontSize: type.xl,
    color: colors.muted,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  target: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.base, marginTop: spacing.sm },
  completeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  offRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  offInput: {
    width: 72,
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    textAlign: "center",
    fontFamily: fonts.sansMedium,
    fontSize: type.xl,
    color: colors.onSurface,
  },
  completeLabel: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.lg, marginBottom: 2 },
  note: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.brandSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  error: { fontFamily: fonts.sans, color: colors.error, fontSize: type.base, marginTop: spacing.lg },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
