/**
 * Google Sign-In → Supabase session.
 *
 * - EAS / native builds: `@react-native-google-signin/google-signin` (id token)
 * - Expo Go / missing native module: browser OAuth via expo-web-browser
 *   (requires Supabase redirect allowlist: mentorforge://**)
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { NativeModules, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

type GoogleSigninModule = {
  configure: (options: { webClientId: string; offlineAccess?: boolean }) => void;
  hasPlayServices: (options?: { showPlayServicesUpdateDialog?: boolean }) => Promise<boolean>;
  signIn: () => Promise<{ type: string; data?: { idToken?: string | null } }>;
  signOut: () => Promise<void>;
};

let configured = false;
let GoogleSignin: GoogleSigninModule | null = null;

export function isNativeGoogleSignInAvailable(): boolean {
  return Platform.OS !== 'web' && Boolean(NativeModules.RNGoogleSignin);
}

function loadNativeGoogleSignin(): GoogleSigninModule | null {
  if (GoogleSignin) return GoogleSignin;
  if (!isNativeGoogleSignInAvailable()) return null;
  try {
    // Only require when the native binary includes the module (not Expo Go).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GoogleSignin = require('@react-native-google-signin/google-signin')
      .GoogleSignin as GoogleSigninModule;
    return GoogleSignin;
  } catch {
    return null;
  }
}

function ensureGoogleConfigured(mod: GoogleSigninModule) {
  if (configured) return;
  if (!webClientId) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  }
  mod.configure({
    webClientId,
    offlineAccess: false,
  });
  configured = true;
}

/** Parse access/refresh tokens or auth code from the OAuth redirect URL. */
async function createSessionFromUrl(url: string) {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  const params = new URLSearchParams(hash || query || '');

  const errorDescription =
    params.get('error_description') ?? params.get('error');
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = params.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
    return data.session;
  }

  throw new Error('Google sign-in returned no session credentials');
}

async function signInWithGoogleBrowser() {
  const redirectTo = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No Google OAuth URL from Supabase');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    return { cancelled: true as const };
  }

  const session = await createSessionFromUrl(result.url);
  return { cancelled: false as const, session };
}

async function signInWithGoogleNative(mod: GoogleSigninModule) {
  ensureGoogleConfigured(mod);

  if (Platform.OS === 'android') {
    await mod.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const result = await mod.signIn();
  if (result.type !== 'success') {
    return { cancelled: true as const };
  }

  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error('Google Sign-In succeeded but no idToken was returned');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return { cancelled: false as const, session: data.session };
}

export async function signInWithGoogle() {
  const mod = loadNativeGoogleSignin();
  if (mod) {
    return signInWithGoogleNative(mod);
  }
  // Expo Go / web / missing native module — browser OAuth fallback
  return signInWithGoogleBrowser();
}

export async function signOutGoogle() {
  const mod = loadNativeGoogleSignin();
  if (mod) {
    try {
      await mod.signOut();
    } catch {
      // Native may be unavailable or never signed in.
    }
  }
  await supabase.auth.signOut();
}
