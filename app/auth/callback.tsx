import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";

import { supabase } from "@/src/lib/supabase";
import { Body, PrimaryButton, Serif } from "@/src/components/ui";
import { colors, spacing, type } from "@/src/theme/theme";

// Parse both query (?a=b) and fragment (#a=b) params from a redirect URL.
function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const grab = (segment?: string) => {
    if (!segment) return;
    for (const pair of segment.split("&")) {
      const [k, v] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  };
  const [beforeHash, hash] = url.split("#");
  grab(beforeHash.split("?")[1]);
  grab(hash);
  return out;
}

async function establishSession(url: string) {
  const params = parseParams(url);
  if (params.error_description || params.error) {
    throw new Error(params.error_description || params.error);
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return;
  }
  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return;
  }
  throw new Error("This confirmation link is missing its sign-in token.");
}

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const run = async (url: string | null) => {
      if (done || !url) return;
      done = true;
      try {
        await establishSession(url);
        router.replace("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't complete sign-in.");
      }
    };

    Linking.getInitialURL().then(run);
    const sub = Linking.addEventListener("url", ({ url }) => {
      done = false;
      run(url);
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.root}>
      {error ? (
        <>
          <Serif size={type.xxl} style={{ textAlign: "center" }}>
            Sign-in link issue
          </Serif>
          <Body style={{ marginTop: spacing.sm, textAlign: "center" }}>{error}</Body>
          <PrimaryButton
            title="Back to sign in"
            testID="callback-back"
            onPress={() => router.replace("/auth")}
            style={{ marginTop: spacing.xl, alignSelf: "stretch" }}
          />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.brand} />
          <Body style={{ marginTop: spacing.lg }}>Signing you in…</Body>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.surface },
});
