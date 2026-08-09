# MentorForge Mobile — Export to `mentorforge-mobile`

This bundle is the production-ready Expo app, cleaned for your repo.

## Emergent → GitHub vs tarball

**Save to GitHub** (`import/emergent-export`) pushes the **whole Emergent workspace** —
`frontend/`, the retired `backend/` stub, tests, patches, etc. The backend stub is
harmless (real API is `https://www.mentorforge.co`); just **do not run EAS from repo
root on that branch**. Either:

- Build from **`frontend/`** on `import/emergent-export`, or
- Use branch **`merge/emergent-export`** (frontend extracted to repo root — **build EAS here**).

Emergent does **not** document a frontend-only GitHub push. For a clean frontend-only
drop, use the prepared **`mentorforge-mobile-frontend.tar.gz`** tarball instead of
Save to GitHub.

If the Emergent UI only offers a new/default repo and won't target
`thirdspaceatlas/mentorforge-mobile`, contact Emergent support with your **job ID** to
enable repo-specific targeting.

The tarball contains **only source** — no `node_modules`, no build caches, no
preview-only `.env`, no secrets.

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

On **`merge/emergent-export`** these are already reconciled:

| Field | Value |
|-------|-------|
| `expo.name` / `expo.slug` | `MentorForge-mobile` |
| `extra.eas.projectId` | `7947e132-5b5f-4e08-812c-21dedd501f70` |
| `owner` | `third-space-atlas` |
| Android package / iOS bundle | `com.mentorforge.app` |
| Calendar + notification permissions | set |

Still verify before each production build:

- **`eas.json`** — `production.autoIncrement: true` bumps `versionCode` (last Play build was **3** → next is **4**)
- **EAS env vars** — `EXPO_PUBLIC_API_URL`, Supabase, Google client IDs (not in git)
- **Play Data safety** — add **Calendar events** for this build (v3 was login-only)

## Native-only features (validate on the dev/production build, not Expo Go)
- Native Google Sign-In (`@react-native-google-signin/google-signin`)
- Push notifications (`expo-notifications`) + device calendar (`expo-calendar`)
