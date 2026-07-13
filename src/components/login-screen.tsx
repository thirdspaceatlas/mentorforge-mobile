import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { signInWithGoogle } from '@/lib/google-auth';
import { supabase } from '@/lib/supabase';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result.cancelled) return;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSignIn() {
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <ThemedText type="title" style={styles.title}>
            MentorForge
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to sync your study plan with the web app.
          </ThemedText>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.buttonPressed,
              busy && styles.buttonDisabled,
            ]}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.googleButtonText}>
                Continue with Google
              </ThemedText>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <ThemedText type="small">or email</ThemedText>
            <View style={styles.divider} />
          </View>

          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!busy}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={email}
          />
          <TextInput
            autoComplete="password"
            editable={!busy}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <Pressable
            accessibilityRole="button"
            disabled={busy || !email || !password}
            onPress={handleEmailSignIn}
            style={({ pressed }) => [
              styles.emailButton,
              pressed && styles.buttonPressed,
              (busy || !email || !password) && styles.buttonDisabled,
            ]}>
            <ThemedText style={styles.emailButtonText}>Sign in</ThemedText>
          </Pressable>

          {error ? (
            <ThemedText style={styles.error}>{error}</ThemedText>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  googleButton: {
    backgroundColor: '#0f1f4a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emailButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  emailButtonText: {
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.one,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
});
