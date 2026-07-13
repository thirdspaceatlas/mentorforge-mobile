import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let configured = false;

function ensureGoogleConfigured() {
  if (configured) return;
  if (!webClientId) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  }

  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
  });
  configured = true;
}

export async function signInWithGoogle() {
  ensureGoogleConfigured();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') {
    return { cancelled: true as const };
  }

  const idToken = result.data.idToken;
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

export async function signOutGoogle() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Native module may be unavailable on web or before first sign-in.
  }
  await supabase.auth.signOut();
}
