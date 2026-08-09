import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { Body, Display, PrimaryButton, Serif } from "@/src/components/ui";
import { colors, fonts, radius, spacing, type } from "@/src/theme/theme";

const HERO =
  "https://images.unsplash.com/photo-1522123472015-2d9f7ee5608d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYXJjaGl0ZWN0dXJlJTIwbGlnaHQlMjBhbmQlMjBzaGFkb3d8ZW58MHx8fHwxNzgyMDYyODQ0fDA&ixlib=rb-4.1.0&q=85";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, resendConfirmation, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const isSignup = mode === "signup";

  async function google() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function resend() {
    setResendState("sending");
    try {
      await resendConfirmation(email.trim());
      setResendState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resend. Try again shortly.");
      setResendState("idle");
    }
  }

  async function submit() {
    setError(null);
    if (!email.trim() || !password.trim() || (isSignup && !name.trim())) {
      setError("Please fill in all fields to continue.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        const { needsConfirmation } = await signUp(name.trim(), email.trim(), password);
        if (needsConfirmation) {
          setConfirmSent(true);
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (confirmSent) {
    return (
      <View style={[styles.root, styles.center, { padding: spacing.xl }]}>
        <Feather name="mail" size={32} color={colors.brand} />
        <Serif size={type.xxl} style={{ marginTop: spacing.lg, textAlign: "center" }}>
          Confirm your email
        </Serif>
        <Body style={{ marginTop: spacing.sm, textAlign: "center" }}>
          We sent a confirmation link to {email.trim()}. Tap it to open MentorForge, then you're in.
        </Body>
        <Pressable
          testID="resend-confirmation"
          disabled={resendState !== "idle"}
          onPress={resend}
          style={{ marginTop: spacing.lg }}
        >
          <Text style={styles.resendText}>
            {resendState === "sending"
              ? "Sending…"
              : resendState === "sent"
                ? "Confirmation email resent ✓"
                : "Didn't get it? Resend confirmation"}
          </Text>
        </Pressable>
        {error && (
          <Text style={[styles.error, { textAlign: "center", marginTop: spacing.sm }]} testID="auth-error-text">
            {error}
          </Text>
        )}
        <PrimaryButton
          title="Back to sign in"
          testID="back-to-signin"
          onPress={() => {
            setConfirmSent(false);
            setResendState("idle");
            setError(null);
            setMode("signin");
          }}
          style={{ marginTop: spacing.xl, alignSelf: "stretch" }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        <LinearGradient colors={["rgba(249,248,246,0)", "rgba(249,248,246,0.6)", colors.surface]} style={StyleSheet.absoluteFill} />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.overline}>CFA STUDY PLANNING, MADE CALM</Text>
        <Display style={{ fontSize: 38, lineHeight: 44, marginTop: spacing.sm }}>MentorForge</Display>
        <Body style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          {isSignup ? "Create your account to sync your study plan across every device." : "Welcome back. Your plan is waiting."}
        </Body>

        {isSignup && (
          <Field label="Name" value={name} onChangeText={setName} placeholder="Jordan Avery" testID="auth-name-input" autoCapitalize="words" />
        )}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" testID="auth-email-input" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" testID="auth-password-input" secureTextEntry autoCapitalize="none" />

        {error && (
          <Text style={styles.error} testID="auth-error-text">
            {error}
          </Text>
        )}

        <PrimaryButton title={isSignup ? "Create account" : "Sign in"} onPress={submit} loading={loading} testID="auth-submit-button" style={{ marginTop: spacing.lg }} />

        <Pressable testID="auth-google-button" disabled={googleLoading} onPress={google} style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}>
          <Feather name="chrome" size={18} color={colors.onSurface} />
          <Text style={styles.googleText}>{googleLoading ? "Connecting…" : "Continue with Google"}</Text>
        </Pressable>

        <Pressable testID="auth-toggle-mode" onPress={() => { setError(null); setMode(isSignup ? "signin" : "signup"); }} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {isSignup ? "Already have an account? " : "New here? "}
            <Text style={styles.toggleStrong}>{isSignup ? "Sign in" : "Create one"}</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ label, testID, ...props }: { label: string; testID: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput testID={testID} placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  content: { paddingHorizontal: spacing.xl, paddingTop: 220 },
  overline: { fontFamily: fonts.sansMedium, color: colors.brand, fontSize: type.sm, letterSpacing: 1.4 },
  fieldLabel: { fontFamily: fonts.sansMedium, color: colors.onSurfaceTertiary, fontSize: type.sm, marginBottom: spacing.sm },
  input: { height: 52, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, fontFamily: fonts.sans, fontSize: type.lg, color: colors.onSurface },
  error: { fontFamily: fonts.sans, color: colors.error, fontSize: type.base, marginTop: spacing.xs },
  googleBtn: { height: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, marginTop: spacing.lg },
  googleText: { fontFamily: fonts.sansMedium, fontSize: type.lg, color: colors.onSurface },
  toggle: { marginTop: spacing.xl, alignItems: "center" },
  toggleText: { fontFamily: fonts.sans, color: colors.onSurfaceTertiary, fontSize: type.base },
  toggleStrong: { fontFamily: fonts.sansMedium, color: colors.brand },
  resendText: { fontFamily: fonts.sansMedium, color: colors.brand, fontSize: type.base, textAlign: "center" },
});
