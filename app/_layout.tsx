import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts } from "expo-font";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { PlanProvider } from "@/src/context/PlanContext";
import { colors } from "@/src/theme/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

// Push: foreground display + Android channel — module scope, before any component.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

export default function RootLayout() {
  const router = useRouter();
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    PlayfairDisplay: require("../assets/fonts/PlayfairDisplay-Regular.ttf"),
    "PlayfairDisplay-Medium": require("../assets/fonts/PlayfairDisplay-Medium.ttf"),
    Geist: require("../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
  });

  const iconsReady = iconsLoaded || iconsError;
  const fontsReady = fontsLoaded || fontsError;

  useEffect(() => {
    if (iconsReady && fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [iconsReady, fontsReady]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const route = (data: Record<string, any>) => {
      const url = data?.deeplink || data?.action_url;
      if (!url || typeof url !== "string") return;
      // Only follow internal in-app routes from a notification payload. External URLs
      // are ignored to avoid an open-redirect via a spoofed/compromised push payload.
      if (url.startsWith("/")) router.push(url);
    };
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) =>
      route(response.notification.request.content.data || {}),
    );
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) route(response.notification.request.content.data || {});
    });
    return () => tapSub.remove();
  }, [router]);

  if (!iconsReady || !fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <PlanProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.surface },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="auth/callback" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="connected" />
                <Stack.Screen name="availability" />
                <Stack.Screen name="sessions" />
                <Stack.Screen
                  name="rebalance"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="week/[week]"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
              </Stack>
            </PlanProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
