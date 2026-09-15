import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { usePlan, CalWindow } from "@/src/context/PlanContext";
import { ApiError } from "@/src/api/client";
import { Body, PrimaryButton, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, type } from "@/src/theme/theme";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

const STATUS: Record<string, { label: string; color: string }> = {
  done: { label: "Done", color: colors.success },
  current: { label: "Now", color: colors.brand },
  upcoming: { label: "Upcoming", color: colors.muted },
  missed: { label: "Missed", color: colors.error },
};

export default function Sessions() {
  const insets = useSafeAreaInsets();
  const { getWindows, startSession, endSession } = usePlan();
  const [windows, setWindows] = useState<CalWindow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const w = await getWindows();
      setWindows([...w].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your study windows.");
      setWindows([]);
    }
  }, [getWindows]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function doStart(w: CalWindow) {
    setBusyId(w.id);
    setError(null);
    try {
      await startSession(w.id, w.durationMin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start that session. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function doEnd(w: CalWindow, action: "complete" | "interrupt") {
    if (!w.session?.id) return;
    setBusyId(w.id);
    setError(null);
    try {
      await endSession(w.session.id, action);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update that session. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  let lastDay = "";

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="sessions-back" onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Study sessions</Text>
        <View style={{ width: 22 }} />
      </View>

      {windows === null ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          <Body style={{ marginBottom: spacing.lg }}>
            Your study windows are generated from your availability and calendar. Start a window when
            you sit down, then mark it complete.
          </Body>

          {error && (
            <Text style={styles.error} testID="sessions-error">
              {error}
            </Text>
          )}

          {windows.length === 0 && !error && (
            <View style={styles.empty}>
              <Feather name="calendar" size={24} color={colors.muted} />
              <Body style={{ marginTop: spacing.sm, textAlign: "center" }}>
                No study windows yet. Use “Sync calendar” on Home to generate them.
              </Body>
            </View>
          )}

          {windows.map((w) => {
            const day = dayKey(w.startTime);
            const showDay = day !== lastDay;
            lastDay = day;
            const st = STATUS[w.status] ?? STATUS.upcoming;
            const active = !!w.session && w.status !== "done";
            const isBusy = busyId === w.id;
            return (
              <View key={w.id}>
                {showDay && <Text style={styles.dayLabel}>{day.toUpperCase()}</Text>}
                <View style={styles.card} testID={`window-${w.id}`}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Serif size={type.lg}>{w.topicName || "Study block"}</Serif>
                      <Text style={styles.time}>
                        {fmtTime(w.startTime)}–{fmtTime(w.endTime)} · {w.durationMin} min
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.color + "22" }]}>
                      <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {w.status !== "done" && (
                    <View style={styles.actions}>
                      {active ? (
                        <>
                          <PrimaryButton
                            title="Complete"
                            onPress={() => doEnd(w, "complete")}
                            loading={isBusy}
                            testID={`complete-${w.id}`}
                            style={{ flex: 1 }}
                          />
                          <PrimaryButton
                            title="Interrupt"
                            variant="outline"
                            onPress={() => doEnd(w, "interrupt")}
                            disabled={isBusy}
                            testID={`interrupt-${w.id}`}
                            style={{ flex: 1 }}
                          />
                        </>
                      ) : (
                        <PrimaryButton
                          title="Start session"
                          onPress={() => doStart(w)}
                          loading={isBusy}
                          testID={`start-${w.id}`}
                          style={{ flex: 1 }}
                        />
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
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
  dayLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.muted,
    fontSize: type.sm,
    letterSpacing: 1.2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  time: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.sm, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: type.sm },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl },
  error: { fontFamily: fonts.sans, color: colors.error, fontSize: type.base, marginBottom: spacing.md },
});
