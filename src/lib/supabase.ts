import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// SecureStore has a 2KB value limit and is native-only; fall back to localStorage on web.
const ExpoSecureStoreAdapter = {
  getItem: (k: string) =>
    Platform.OS === "web" ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) =>
    Platform.OS === "web"
      ? Promise.resolve(globalThis.localStorage?.setItem(k, v))
      : SecureStore.setItemAsync(k, v),
  removeItem: (k: string) =>
    Platform.OS === "web"
      ? Promise.resolve(globalThis.localStorage?.removeItem(k))
      : SecureStore.deleteItemAsync(k),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
