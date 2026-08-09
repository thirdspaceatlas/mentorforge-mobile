import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { usePlan } from "@/src/context/PlanContext";
import { ApiError } from "@/src/api/client";
import { Body, PrimaryButton, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, statusColor, type } from "@/src/theme/theme";

type OptionMeta = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  cta: string;
};

const OPTION_META: Record<string, OptionMeta> = {
  "extend-exam-window": {
    icon: "calendar",
    title: "Extend your exam window",
    desc: "Push your exam date out so your logged progress still carries over. Honest runway, no cramming.",
    cta: "Extend exam date",
  },
  "raise-capacity": {
    icon: "trending-up",
    title: "Raise your daily capacity",
    desc: "Lift your daily study ceiling so the plan fits. Powerful, but watch for burnout.",
    cta: "Raise the ceiling",
  },
  "reduce-scope": {
    icon: "scissors",
    title: "Reduce scope",
    desc: "Drop the lowest-weight topics to save time and keep the rest on track.",
    cta: "Trim my scope",
  },
  "accept-gap": {
    icon: "flag",
    title: "Accept the gap",
    desc: "Keep everything as-is and knowingly accept that some hours won't be covered.",
    cta: "Accept the gap",
  },
};

export default function Rebalance() {
  const insets = useSafeAreaInsets();
  const { plan, resolveInfeasible } = usePlan();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!plan) return null;
  const fb = plan.summary.feasibility;
  const opts = fb.options;
  const sc = statusColor[fb.grade] ?? statusColor.on_track;

  async function act(resolution: string) {
    setBusy(resolution);
    setError(null);
    try {
      await resolveInfeasible(resolution);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't apply that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="rebalance-close" onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Rebalance</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.gradeBanner, { backgroundColor: sc.bg }]}>
          <Text style={[styles.gradeLabel, { color: sc.fg }]}>{fb.grade_label.toUpperCase()}</Text>
          <Serif size={type.xxl} style={{ marginTop: spacing.xs }}>
            {fb.unplaced_hours > 0
              ? `${fb.unplaced_hours}h can't fit before your exam`
              : "Your plan fits your available time"}
          </Serif>
          {fb.message && <Body style={{ marginTop: spacing.sm }}>{fb.message}</Body>}
        </View>

        {opts && opts.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>CHOOSE AN HONEST TRADEOFF</Text>
            {opts.map((key) => {
              const meta = OPTION_META[key];
              if (!meta) return null;
              return (
                <OptionCard
                  key={key}
                  icon={meta.icon}
                  title={meta.title}
                  desc={meta.desc}
                  cta={meta.cta}
                  loading={busy === key}
                  onPress={() => act(key)}
                  testID={`option-${key}`}
                />
              );
            })}
            {error && (
              <Text style={styles.error} testID="rebalance-error">
                {error}
              </Text>
            )}
          </>
        ) : (
          <View style={styles.calm}>
            <Feather name="check-circle" size={28} color={colors.brand} />
            <Serif size={type.xl} style={{ marginTop: spacing.md, textAlign: "center" }}>
              Nothing to rebalance
            </Serif>
            <Body style={{ marginTop: spacing.xs, textAlign: "center" }}>
              Your remaining load fits within your available time.
            </Body>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function OptionCard({
  icon,
  title,
  desc,
  cta,
  onPress,
  loading,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  cta: string;
  onPress: () => void;
  loading: boolean;
  testID: string;
}) {
  return (
    <View style={styles.optionCard}>
      <View style={styles.optionHead}>
        <Feather name={icon} size={18} color={colors.brand} />
        <Serif size={type.lg}>{title}</Serif>
      </View>
      <Body style={{ marginTop: spacing.xs }}>{desc}</Body>
      <PrimaryButton
        title={cta}
        variant="outline"
        onPress={onPress}
        loading={loading}
        testID={testID}
        style={{ marginTop: spacing.md }}
      />
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
  gradeBanner: { borderRadius: radius.lg, padding: spacing.xl },
  gradeLabel: { fontFamily: fonts.sansMedium, fontSize: type.sm, letterSpacing: 1.4 },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.muted,
    fontSize: type.sm,
    letterSpacing: 1.4,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  optionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  calm: { alignItems: "center", paddingVertical: spacing.xxl },
  error: { fontFamily: fonts.sans, color: colors.error, fontSize: type.base, marginTop: spacing.sm },
});
