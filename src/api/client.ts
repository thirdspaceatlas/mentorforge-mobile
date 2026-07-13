import { supabase } from '@/lib/supabase';

const baseUrl = process.env.EXPO_PUBLIC_API_URL;

function getApiBase() {
  if (!baseUrl) {
    throw new Error('Missing EXPO_PUBLIC_API_URL');
  }
  return baseUrl.replace(/\/$/, '');
}

export async function api(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${getApiBase()}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    throw new Error('unauthorized');
  }

  return res;
}
