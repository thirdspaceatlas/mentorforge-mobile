import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";

import { colors, fonts, radius, spacing, type } from "@/src/theme/theme";

// ---------- Typography ----------
export function Display({ children, style, testID }: { children: React.ReactNode; style?: TextStyle; testID?: string }) {
  return <Text testID={testID} style={[styles.display, style]}>{children}</Text>;
}
export function Serif({
  children,
  style,
  size = type.xl,
}: {
  children: React.ReactNode;
  style?: TextStyle;
  size?: number;
}) {
  return <Text style={[{ fontFamily: fonts.serifMedium, color: colors.onSurface, fontSize: size }, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}
export function Overline({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.overline, style]}>{children}</Text>;
}

// ---------- Button ----------
export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  testID,
  variant = "solid",
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  variant?: "solid" | "outline";
  style?: ViewStyle;
}) {
  const isOutline = variant === "outline";
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        isOutline ? styles.btnOutline : styles.btnSolid,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.onSurface : colors.onBrandPrimary} />
      ) : (
        <Text style={[styles.btnText, { color: isOutline ? colors.onSurface : colors.onBrandPrimary }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// ---------- Pill ----------
export function Pill({
  label,
  bg = colors.brandTertiary,
  fg = colors.onBrandTertiary,
  testID,
}: {
  label: string;
  bg?: string;
  fg?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ---------- Divider ----------
export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

// ---------- Card ----------
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------- Progress Ring ----------
export function ProgressRing({
  size = 64,
  stroke = 5,
  progress = 0,
  color = colors.brand,
  track = colors.border,
  children,
}: {
  size?: number;
  stroke?: number;
  progress?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: fonts.serifMedium,
    color: colors.onSurface,
    fontSize: type.display,
    lineHeight: type.display * 1.18,
  },
  body: {
    fontFamily: fonts.sans,
    color: colors.onSurfaceTertiary,
    fontSize: type.base,
    lineHeight: type.base * 1.5,
  },
  label: {
    fontFamily: fonts.sans,
    color: colors.onSurface,
    fontSize: type.base,
  },
  overline: {
    fontFamily: fonts.sansMedium,
    color: colors.muted,
    fontSize: type.sm,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  btn: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  btnSolid: { backgroundColor: colors.brandPrimary },
  btnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderStrong },
  btnText: { fontFamily: fonts.sansMedium, fontSize: type.lg },
  pill: {
    paddingHorizontal: spacing.md,
    height: 26,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontFamily: fonts.sansMedium, fontSize: type.sm },
  divider: { height: 1, backgroundColor: colors.divider },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
});
