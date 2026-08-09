// Local notification scheduling + Expo push registration against the shared backend.
// All native-only; every entry point guards against web.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

import { api } from "@/src/api/client";

/** Register the device's Expo push token with the shared backend (/push/register-mobile). */
export async function registerForPush() {
  if (Platform.OS === "web" || !Device.isDevice) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted" && perm.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api("/push/register-mobile", {
      method: "POST",
      body: { expoPushToken: tokenResp.data, platform: Platform.OS },
    });
  } catch {
    // non-blocking: push only works in a real build, not Expo Go / web
  }
}

export async function ensureLocalPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === "granted";
}

/** Daily "today's session" reminder + weekly Sunday digest. */
export async function scheduleStudyReminders(hour = 18, minute = 0) {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Today's study session",
      body: "Your MentorForge docket is ready. A calm, focused block keeps you on pace.",
      data: { action_url: "/" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your week ahead",
      body: "Here's your MentorForge pacing for the week. Stay calm, stay on track.",
      data: { action_url: "/plan" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0 },
  });
}

export async function cancelReminders() {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
