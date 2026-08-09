# MentorForge Mobile — Export to `mentorforge-mobile`

This bundle is the production-ready Expo app, cleaned for your repo. The tarball
`mentorforge-mobile-frontend.tar.gz` contains **only source** — no `node_modules`,
no build caches, no preview-only `.env`, no secrets.

## What's included
```
app/            Expo Router screens (tabs, auth, onboarding, availability, rebalance)
src/            api client, services (calendar, notifications, googleSignIn), context, lib
assets/ constants/ scripts/
app.json  package.json  yarn.lock  tsconfig.json  metro.config.js  eslint.config.js
google-services.json  GoogleService-Info.plist   (Google/Firebase config)
.env.example    (copy → .env; real values go in EAS env vars)
```

## What's excluded (intentionally)
- `node_modules/`, `.expo/`, `.metro-cache/`, `dist/` — regenerated on install/build
- The live `.env` — it held Emergent preview-only vars (`EXPO_PACKAGER_*`,
  `EXPO_TUNNEL_SUBDOMAIN`, a proxy `EXPO_PUBLIC_BACKEND_URL`). Use `.env.example`.

## Drop-in steps
1. Extract into your `mentorforge-mobile` repo root (or a `frontend/` subdir if you keep the split).
2. `yarn install` (repo pins `packageManager`/`.yarnrc`; Node 20 ok via `ignore-engines`).
3. `cp .env.example .env` and fill the empty values (or set them as EAS env vars).

## EAS env vars to set (Project → Environment variables)
Only these are needed at build time; everything else has safe defaults:
- `EXPO_PUBLIC_API_URL = https://www.mentorforge.co`
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`

## Confirm before Play submit (app.json)
Reconciled for `third-space-atlas` / EAS project `7947e132-5b5f-4e08-812c-21dedd501f70`:
- `expo.name` = `"MentorForge-mobile"`
- `expo.slug` = `"MentorForge-mobile"`
- `extra.eas.projectId` — set
- `com.mentorforge.app` + calendar/notification permissions — set
- Production env: set **`EXPO_PUBLIC_API_URL`** (and Supabase/Google vars) in EAS only

## Native-only features (validate on the dev/production build, not Expo Go)
- Native Google Sign-In (`@react-native-google-signin/google-signin`)
- Push notifications (`expo-notifications`) + device calendar (`expo-calendar`)
