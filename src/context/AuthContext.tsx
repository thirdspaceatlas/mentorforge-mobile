import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { Session } from "@supabase/supabase-js";

import { supabase } from "@/src/lib/supabase";
import { googleSignIn, googleSignOut } from "@/src/services/googleSignIn";

export type User = {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  auth_provider: string;
};

// Where Supabase should send the user after they tap the confirmation link.
// Native uses the custom app scheme; web uses the current origin.
export const AUTH_REDIRECT_TO =
  Platform.OS === "web" && typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "mentorforge://auth/callback";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function toUser(s: Session | null): User | null {
  if (!s?.user) return null;
  const u = s.user;
  const meta = u.user_metadata ?? {};
  const name =
    (meta.first_name as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    (u.email ?? "").split("@")[0];
  const picture = (meta.avatar_url as string) || (meta.picture as string) || null;
  const auth_provider = (u.app_metadata?.provider as string) || "email";
  return { id: u.id, email: u.email ?? "", name, picture, auth_provider };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      throw new Error(
        error.message === "Email not confirmed"
          ? "Please confirm your email first — check your inbox for the link."
          : error.message,
      );
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { first_name: name.trim() }, emailRedirectTo: AUTH_REDIRECT_TO },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: AUTH_REDIRECT_TO },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await googleSignIn();
  }, []);

  const signOut = useCallback(async () => {
    await googleSignOut();
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user: toUser(session), session, loading, signIn, signUp, resendConfirmation, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
