import { useMemo, useState, useCallback } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { usePlan, Week } from "@/src/context/PlanContext";
import { Body, Pill, ProgressRing, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, type } from "@/src/theme/theme";

const FILTERS = [
  { key: "all", label: "All weeks" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "review", label: "Review" },
];

function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const m = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  if (m(s) === m(e)) return `${s.getDate()}–${e.getDate()} ${m(e)}`;
  return `${s.getDate()} ${m(s)} – ${e.getDate()} ${m(e)}`;
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { plan, refresh } = usePlan();
  const [filter, setFilter] = useState("all");

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const currentWeekNum = plan?.summary.current_week ?? null;

  const weeks = useMemo(() => {
    if (!plan) return [];
    switch (filter) {
      case "upcoming":
        return plan.weeks.filter((w) => !w.completed);
      case "completed":
        return plan.weeks.filter((w) => w.completed);
      case "review":
        return plan.weeks.filter((w) => w.is_review);
      default:
        return plan.weeks;
    }
  }, [plan, filter]);

  if (!plan) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerTop}>
          <View>
            <Serif size={type.xxl}>Your plan</Serif>
            <Text style={styles.sub}>
              {plan.level_label} · {plan.weekly_hours}h/week · {plan.summary.total_weeks} weeks
            </Text>
          </View>
          <ProgressRing size={48} stroke={4} progress={plan.summary.progress_pct / 100}>
            <Text style={styles.ringPct}>{plan.summary.progress_pct}</Text>
          </ProgressRing>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipContent}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={weeks}
        keyExtractor={(w) => String(w.week_number)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={24} color={colors.muted} />
            <Body style={{ marginTop: spacing.sm }}>No weeks in this view.</Body>
          </View>
        }
        renderItem={({ item }) => (
          <WeekCard
            week={item}
            isCurrent={item.week_number === currentWeekNum}
            range={fmtRange(item.start_date, item.end_date)}
            onPress={() => router.push(`/week/${item.week_number}`)}
          />
        )}
      />
    </View>
  );
}

function WeekCard({
  week,
  isCurrent,
  range,
  onPress,
}: {
  week: Week;
  isCurrent: boolean;
  range: string;
  onPress: () => void;
}) {
  const progress = week.adjusted_hours ? week.logged_hours / week.adjusted_hours : 0;
  return (
    <Pressable
      testID={`week-card-${week.week_number}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, isCurrent && styles.cardCurrent, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.cardHead}>
        <View style={styles.weekNum}>
          <Text style={styles.weekNumLabel}>WK</Text>
          <Serif size={type.xxl}>{week.week_number}</Serif>
        </View>
        <View style={{ flex: 1 }}>
          <Serif size={type.lg}>{week.focus}</Serif>
          <Text style={styles.cardRange}>{range}</Text>
        </View>
        {week.completed ? (
          <View style={styles.doneBadge}>
            <Feather name="check" size={14} color={colors.onSuccess} />
          </View>
        ) : (
          <ProgressRing size={40} stroke={4} progress={progress} />
        )}
      </View>

      <View style={styles.cardMeta}>
        {isCurrent && <Pill label="This week" bg={colors.brand} fg={colors.onBrandPrimary} />}
        {week.is_review && <Pill label="Review" />}
        <Text style={styles.metaText}>
          {week.logged_hours}h / {week.adjusted_hours}h
        </Text>
      </View>

      <View style={styles.topics}>
        {week.sessions.slice(0, 3).map((s, i) => (
          <Text key={i} style={styles.topicLine} numberOfLines={1}>
            · {s.topic} — {s.label}
          </Text>
        ))}
        {week.sessions.length > 3 && (
          <Text style={styles.topicMore}>+{week.sessions.length - 3} more</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: spacing.sm,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  sub: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginTop: 2 },
  ringPct: { fontFamily: fonts.sansMedium, color: colors.onSurface, fontSize: type.sm },
  chipRow: { height: 56 },
  chipContent: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: colors.surfaceSecondary,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontFamily: fonts.sansMedium, color: colors.onSurfaceTertiary, fontSize: type.base },
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardCurrent: { borderColor: colors.brand },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  weekNum: { alignItems: "center", width: 40 },
  weekNumLabel: { fontFamily: fonts.sansMedium, color: colors.muted, fontSize: 10, letterSpacing: 1 },
  cardRange: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginTop: 2 },
  doneBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  metaText: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.sm, marginLeft: "auto" },
  topics: { marginTop: spacing.md, gap: 2 },
  topicLine: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.sm },
  topicMore: { fontFamily: fonts.sansMedium, color: colors.brand, fontSize: type.sm, marginTop: 2 },
});
