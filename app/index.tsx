import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { usePlan } from "@/src/context/PlanContext";
import { colors } from "@/src/theme/theme";
import { Display } from "@/src/components/ui";

function Splash() {
  return (
    <View style={styles.splash} testID="splash-screen">
      <Display style={{ marginBottom: 24 }}>MentorForge</Display>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export default function Index() {
  const { session, loading } = useAuth();
  const { fetched, plan } = usePlan();

  if (loading) return <Splash />;
  if (!session) return <Redirect href="/auth" />;
  if (!fetched) return <Splash />;
  if (!plan) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
