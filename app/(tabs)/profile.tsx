import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { usePlan } from "@/src/context/PlanContext";
import { Body, PrimaryButton, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, type } from "@/src/theme/theme";

const TEXTURE =
  "https://images.unsplash.com/photo-1616410731303-6affae095a0a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwyfHxjYWxtJTIwYWJzdHJhY3QlMjBwYXBlciUyMHRleHR1cmV8ZW58MHx8fHwxNzgyMDYyODQ0fDA&ixlib=rb-4.1.0&q=85";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { plan, resetPlan } = usePlan();
  const [confirm, setConfirm] = useState<null | "reset" | "signout">(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const initials = (user?.name || "S")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function onConfirm() {
    setBusy(true);
    setActionError(null);
    try {
      if (confirm === "reset") {
        await resetPlan();
        setConfirm(null);
        router.replace("/onboarding");
      } else if (confirm === "signout") {
        await signOut();
        setConfirm(null);
        router.replace("/auth");
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={{ uri: TEXTURE }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(249,248,246,0.2)", colors.surface]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHead}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Serif size={type.xxl} style={{ marginTop: spacing.md }}>
            {user?.name}
          </Serif>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Subscription card */}
        <View style={styles.subCard}>
          <View style={styles.subHead}>
            <Text style={styles.subTier}>FREE PLAN</Text>
            <Feather name="award" size={18} color={colors.brand} />
          </View>
          <Serif size={type.xl} style={{ marginTop: spacing.sm, color: colors.onSurfaceInverse }}>
            All Access — $99/yr
          </Serif>
          <Text style={styles.subBlurb}>
            Unlock Levels II & III, unlimited Calendar Coach nudges, and full progress history.
          </Text>
          <View style={styles.upgradeNote}>
            <Feather name="clock" size={13} color={colors.muted} />
            <Text style={styles.upgradeNoteText}>Upgrades arrive soon — you&apos;re on the free tier.</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STUDY</Text>
          <Row
            icon="layers"
            label="Current level"
            value={plan?.level_label ?? "No plan"}
            testID="profile-level-row"
          />
          <Row
            icon="calendar"
            label="Exam date"
            value={
              plan
                ? new Date(plan.exam_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : "—"
            }
          />
          <Row
            icon="sliders"
            label="Availability & pacing"
            onPress={() => router.push("/availability")}
            testID="profile-availability-row"
            chevron
          />
          <Row
            icon="refresh-cw"
            label="Rebuild plan"
            onPress={() => setConfirm("reset")}
            testID="profile-reset-row"
            chevron
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Row
            icon="shield"
            label="Sign-in method"
            value={user?.auth_provider === "google" ? "Google" : "Email"}
          />
          <Row
            icon="log-out"
            label="Sign out"
            onPress={() => setConfirm("signout")}
            testID="profile-signout-row"
            chevron
            danger
          />
        </View>

        <Text style={styles.disclaimer}>
          Independent study-planning software. Not affiliated with, endorsed, or promoted by CFA Institute.
        </Text>
      </ScrollView>

      <Modal visible={confirm !== null} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.backdrop} onPress={() => !busy && (setConfirm(null), setActionError(null))}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Serif size={type.xl} style={{ marginTop: spacing.md }}>
              {confirm === "reset" ? "Rebuild your plan?" : "Sign out?"}
            </Serif>
            <Body style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
              {confirm === "reset"
                ? "This clears your current plan and logged hours so you can set up a fresh runway."
                : "You can sign back in anytime to pick up exactly where you left off."}
            </Body>
            {actionError && (
              <Text style={styles.actionError} testID="profile-action-error">
                {actionError}
              </Text>
            )}
            <PrimaryButton
              testID="confirm-action-button"
              title={confirm === "reset" ? "Rebuild plan" : "Sign out"}
              onPress={onConfirm}
              loading={busy}
            />
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => {
                setConfirm(null);
                setActionError(null);
              }}
              style={{ marginTop: spacing.sm }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  chevron,
  danger,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.6 }]}
    >
      <Feather name={icon} size={18} color={danger ? colors.error : colors.onSurfaceTertiary} />
      <Text style={[styles.rowLabel, danger && { color: colors.error }]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {chevron && <Feather name="chevron-right" size={18} color={colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  content: { paddingHorizontal: spacing.xl },
  profileHead: { alignItems: "center", marginBottom: spacing.xl },
  avatar: { width: 76, height: 76, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serifMedium, color: colors.onBrandPrimary, fontSize: type.xxl },
  email: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.base, marginTop: 2 },
  subCard: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  subHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subTier: { fontFamily: fonts.sansMedium, color: "#B7BDB6", fontSize: type.sm, letterSpacing: 1.4 },
  subBlurb: {
    fontFamily: fonts.sans,
    color: "#B7BDB6",
    fontSize: type.base,
    lineHeight: type.base * 1.5,
    marginTop: spacing.xs,
  },
  upgradeNote: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.lg },
  upgradeNoteText: { fontFamily: fonts.sans, color: "#9AA09A", fontSize: type.sm },
  section: { marginBottom: spacing.xl },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.muted,
    fontSize: type.sm,
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: { fontFamily: fonts.sans, color: colors.onSurface, fontSize: type.lg, flex: 1 },
  rowValue: { fontFamily: fonts.sans, color: colors.muted, fontSize: type.base },
  disclaimer: {
    fontFamily: fonts.sans,
    color: colors.muted,
    fontSize: type.sm,
    lineHeight: type.sm * 1.5,
    textAlign: "center",
    marginTop: spacing.md,
  },
  // Subtle override on overline-styled inverse subcard text handled above
  subCardTitle: {} as any,
  backdrop: { flex: 1, backgroundColor: "rgba(28,27,26,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg * 2,
    borderTopRightRadius: radius.lg * 2,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: "center",
  },
  actionError: {
    fontFamily: fonts.sans,
    color: colors.error,
    fontSize: type.base,
    marginBottom: spacing.md,
  },
});
