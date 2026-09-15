// Native Google Sign-In → Supabase session.
// The native module (RNGoogleSignin) only exists in an EAS dev/production build,
// NOT in Expo Go or on web. We therefore LAZY-load it inside the functions so that
// merely importing this module never touches the native binary at app startup
// (which would crash Expo Go with a TurboModule "RNGoogleSignin could not be found").
import Constants from "expo-constants";

import { supabase } from "@/src/lib/supabase";

const IN_EXPO_GO =
  Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";

const NOT_AVAILABLE_MSG =
  "Google sign-in needs the installed MentorForge app build (it isn't available in Expo Go). Please use email sign-in here.";

function loadGoogleSignin() {
  if (IN_EXPO_GO) throw new Error(NOT_AVAILABLE_MSG);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@react-native-google-signin/google-signin");
  if (!mod?.GoogleSignin) throw new Error(NOT_AVAILABLE_MSG);
  return mod.GoogleSignin as {
    configure: (o: Record<string, unknown>) => void;
    hasPlayServices: (o?: Record<string, unknown>) => Promise<boolean>;
    signIn: () => Promise<unknown>;
    signOut: () => Promise<unknown>;
  };
}

let configured = false;
function ensureConfigured(GoogleSignin: ReturnType<typeof loadGoogleSignin>) {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!webClientId) {
    throw new Error("Google sign-in isn't configured yet. Please try again shortly.");
  }
  GoogleSignin.configure(iosClientId ? { webClientId, iosClientId } : { webClientId });
  configured = true;
}

export async function googleSignIn(): Promise<void> {
  const GoogleSignin = loadGoogleSignin();
  ensureConfigured(GoogleSignin);
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  // v13+ returns { type, data: { idToken, user } }; older returns { idToken } directly.
  const idToken =
    (result as { data?: { idToken?: string } }).data?.idToken ??
    (result as { idToken?: string }).idToken;
  if (!idToken) throw new Error("Google didn't return an ID token. Please try again.");
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
  if (error) throw new Error(error.message);
}

export async function googleSignOut(): Promise<void> {
  if (IN_EXPO_GO) return;
  try {
    const GoogleSignin = loadGoogleSignin();
    await GoogleSignin.signOut();
  } catch {
    // ignore — user may not have signed in via Google, or module unavailable
  }
}
