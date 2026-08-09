import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { usePlan } from "@/src/context/PlanContext";
import { ApiError } from "@/src/api/client";
import { Body, Display, PrimaryButton, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, type } from "@/src/theme/theme";

const LEVELS = [
  { code: "I", label: "Level I", blurb: "Foundations across all ten topic areas." },
  { code: "II", label: "Level II", blurb: "Asset valuation in greater depth." },
  { code: "III", label: "Level III", blurb: "Portfolio management & wealth planning." },
];

const START_OPTIONS = [
  { label: "Today", offsetDays: 0 },
  { label: "In one week", offsetDays: 7 },
  { label: "In two weeks", offsetDays: 14 },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function nextExamWindows(count: number) {
  const months = [1, 4, 7, 10]; // Feb, May, Aug, Nov
  const today = new Date();
  const out: { label: string; iso: string }[] = [];
  let year = today.getFullYear();
  while (out.length < count) {
    for (const m of months) {
      const d = new Date(year, m, 15);
      if (d.getTime() - today.getTime() > 1000 * 60 * 60 * 24 * 28) {
        out.push({
          label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          iso: iso(d),
        });
      }
      if (out.length >= count) break;
    }
    year += 1;
  }
  return out;
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { createPlan } = usePlan();
  const windows = useMemo(() => nextExamWindows(6), []);

  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<string | null>(null);
  const [examIso, setExamIso] = useState<string | null>(null);
  const [startOffset, setStartOffset] = useState<number>(0);
  const [weeklyHours, setWeeklyHours] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 4;
  const canContinue =
    (step === 0 && !!level) ||
    (step === 1 && !!examIso) ||
    step === 2 ||
    step === 3;

  async function finish() {
    if (!level || !examIso) return;
    const start = new Date();
    start.setDate(start.getDate() + startOffset);
    setSubmitting(true);
    setError(null);
    try {
      await createPlan({
        level,
        exam_date: examIso,
        start_date: iso(start),
        weekly_hours: weeklyHours,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not build your plan. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onNext() {
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable testID="onboarding-back" onPress={() => setStep(step - 1)} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i <= step && { backgroundColor: colors.brand, width: 22 }]}
            />
          ))}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <Step
            kicker="STEP 01"
            title="Which level are you sitting?"
            subtitle="Topic sequencing and exam weights adapt to your level."
          >
            {LEVELS.map((l) => (
              <SelectCard
                key={l.code}
                testID={`level-option-${l.code}`}
                selected={level === l.code}
                title={l.label}
                subtitle={l.blurb}
                onPress={() => setLevel(l.code)}
              />
            ))}
          </Step>
        )}

        {step === 1 && (
          <Step
            kicker="STEP 02"
            title="When is your exam window?"
            subtitle="We anchor your whole plan to this date."
          >
            {windows.map((w) => (
              <SelectCard
                key={w.iso}
                testID={`exam-option-${w.iso}`}
                selected={examIso === w.iso}
                title={w.label}
                onPress={() => setExamIso(w.iso)}
              />
            ))}
          </Step>
        )}

        {step === 2 && (
          <Step
            kicker="STEP 03"
            title="When will you start?"
            subtitle="Partial weeks are prorated so your runway stays honest."
          >
            {START_OPTIONS.map((o) => (
              <SelectCard
                key={o.offsetDays}
                testID={`start-option-${o.offsetDays}`}
                selected={startOffset === o.offsetDays}
                title={o.label}
                onPress={() => setStartOffset(o.offsetDays)}
              />
            ))}
          </Step>
        )}

        {step === 3 && (
          <Step
            kicker="STEP 04"
            title="Hours per week?"
            subtitle="Be realistic — we'll rebalance whenever life gets in the way."
          >
            <View style={styles.stepper} testID="weekly-hours-stepper">
              <Pressable
                testID="hours-decrement"
                onPress={() => setWeeklyHours((h) => Math.max(3, h - 1))}
                style={styles.stepBtn}
              >
                <Feather name="minus" size={22} color={colors.onSurface} />
              </Pressable>
              <View style={styles.hoursDisplay}>
                <Display style={{ fontSize: 56 }}>{weeklyHours}</Display>
                <Body style={{ marginTop: -spacing.xs }}>hours / week</Body>
              </View>
              <Pressable
                testID="hours-increment"
                onPress={() => setWeeklyHours((h) => Math.min(40, h + 1))}
                style={styles.stepBtn}
              >
                <Feather name="plus" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <View style={styles.presetRow}>
              {[8, 12, 15, 20].map((p) => (
                <Pressable
                  key={p}
                  testID={`hours-preset-${p}`}
                  onPress={() => setWeeklyHours(p)}
                  style={[styles.preset, weeklyHours === p && styles.presetActive]}
                >
                  <Text style={[styles.presetText, weeklyHours === p && { color: colors.onBrandPrimary }]}>
                    {p}h
                  </Text>
                </Pressable>
              ))}
            </View>
          </Step>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="onboarding-continue"
          title={step === totalSteps - 1 ? "Build my plan" : "Continue"}
          onPress={onNext}
          disabled={!canContinue}
          loading={submitting}
        />
      </View>
    </View>
  );
}

function Step({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={styles.kicker}>{kicker}</Text>
      <Display style={{ marginTop: spacing.sm }}>{title}</Display>
      <Body style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>{subtitle}</Body>
      {children}
    </View>
  );
}

function SelectCard({
  title,
  subtitle,
  selected,
  onPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.selectCard, selected && styles.selectCardActive]}
    >
      <View style={{ flex: 1 }}>
        <Serif size={type.xl} style={selected ? { color: colors.onBrandSecondary } : undefined}>
          {title}
        </Serif>
        {subtitle && <Body style={{ marginTop: spacing.xs }}>{subtitle}</Body>}
      </View>
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected && <Feather name="check" size={14} color={colors.onBrandPrimary} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  dots: { flexDirection: "row", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.border },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  kicker: { fontFamily: fonts.sansMedium, color: colors.brand, fontSize: type.sm, letterSpacing: 1.4 },
  selectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  selectCardActive: { borderColor: colors.brand, backgroundColor: colors.brandSecondary },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.md,
  },
  radioActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  hoursDisplay: { alignItems: "center" },
  presetRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl, justifyContent: "center" },
  preset: {
    paddingHorizontal: spacing.lg,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  presetActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  presetText: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.base },
  error: { fontFamily: fonts.sans, color: colors.error, fontSize: type.base, marginTop: spacing.lg },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
