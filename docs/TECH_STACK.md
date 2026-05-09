# Tech Stack

## Core

| Package | Version | Why |
|---------|---------|-----|
| [Next.js](https://nextjs.org/) | 16.2.0 | App Router, API routes, server-side Firebase Admin, SSR/client split |
| [React](https://react.dev/) | 19.2.0 | UI, concurrent features |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Strict mode throughout; no `any` in app code |

## Gaze Tracking

The patient home defaults to an **in-browser MediaPipe iris pipeline** (TensorFlow.js + self-hosted MediaPipe-style assets under `public/@mediapipe/`). No external SDK is required for the default path. **Eyedid (seeso)** is supported as an opt-in alternative for environments that want its 5-point calibration.

| Path | Package | Version | Notes |
|------|---------|---------|-------|
| **Default** | `@tensorflow/tfjs` + self-hosted MediaPipe assets | (see `package.json`) | Face / iris detection + gaze heuristics; no license key, no calibration step. |
| Opt-in | [`seeso`](https://docs.eyedid.ai/) | 0.2.4 | Eyedid Web SDK (WebAssembly). 5-point calibration, gaze point (x,y), attention score, blink detection. Enabled via `NEXT_PUBLIC_EYEDID_LICENSE_KEY`. |

**Notes:**
- Eyedid: must be transpiled by Next.js (`transpilePackages` in `next.config.ts`).
- Eyedid: license key required only when this path is enabled (`NEXT_PUBLIC_EYEDID_LICENSE_KEY`).
- ~~COOP/COEP headers~~ no longer set — current Eyedid build does not require `SharedArrayBuffer`. See the comment in `next.config.ts` for history.

## AI

Gemini access is server-side only. **`/api/chat` uses REST (`fetch`)**, while **`/api/family-summary` uses `@google/genai`**.

| Surface | Endpoint | Notes |
|---------|----------|-------|
| Triage | `POST /api/chat` | Structured JSON reply for the voice/AI flow (REST via `fetch`) |
| Family summary | `POST /api/family-summary` | Uses `@google/genai` (`GoogleGenAI.models.generateContent`) |

**Base URL:** `https://generativelanguage.googleapis.com/v1beta` (override with `GEMINI_API_BASE`).

**Models:**
- Triage: `gemini-2.5-flash` (configurable via `GEMINI_MODEL`)
- Family summary: `gemini-1.5-flash`
- Fallback: `localTriage()` regex-based priority classifier (no network required)

## Database & Auth

| Package | Version | Why |
|---------|---------|-----|
| [firebase](https://firebase.google.com/) | 12.11.0 | Firestore (client) — real-time call updates, video message storage |
| [firebase-admin](https://firebase.google.com/docs/admin) | 13.7.0 | Firestore (server-side API routes), secure operations |

## UI

| Package | Version | Why |
|---------|---------|-----|
| [tailwindcss](https://tailwindcss.com/) | 4 | Utility-first CSS; no CSS modules, minimal custom CSS |
| [lucide-react](https://lucide.dev/) | 0.577.0 | Icon set |
| [recharts](https://recharts.org/) | 3.8.0 | Charts on dashboard/history |

## Browser APIs (no package)

| API | Used for |
|-----|---------|
| Web Speech API (`SpeechRecognition`) | Voice input during AI conversation |
| Speech Synthesis API | TTS responses (Japanese Nanami voice preferred) |
| Web Audio API | Submit sound ("pon"), alert sound ("ping-pong") |
| MediaDevices / getUserMedia | Camera for gaze tracking |
| localStorage | Calibration cache, gaze tuning parameters |

## Testing

| Package | Version | Why |
|---------|---------|-----|
| [vitest](https://vitest.dev/) | 4.1.4 | Fast unit tests; jsdom environment for DOM APIs |

**Test files:** `**/*.test.ts` — unit tests for gaze algorithms, triage logic, localStorage utils.

## Dev Tooling

| Package | Version | Why |
|---------|---------|-----|
| [eslint](https://eslint.org/) | 9 | Linting; Next.js core-web-vitals + TypeScript configs |

**Quality scripts:**
```bash
npm run run:quality   # Fast: gaze lint + tests (local dev)
npm run run:verify    # Full CI: lint + tests + type-check + build
npm run run:auto      # Watch mode: reruns quality on file changes
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_EYEDID_LICENSE_KEY` | No (required only if the Eyedid path is enabled) | Eyedid/seeso gaze SDK license. The default MediaPipe iris path does not need this. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase client config |
| `GEMINI_API_KEY` | Yes (for AI) | Server-side Gemini API key |
| `GEMINI_API_BASE` | No | Override Gemini base URL (used by chat route) |
| `GEMINI_MODEL` | No | Override model (default: `gemini-2.5-flash`) |
| `NEXT_PUBLIC_VIDEO_MESSAGES_COLLECTION` | No | Firestore collection for family videos (default: `messages`) |

Copy `.env.example` to `.env.local` and fill in values before starting the dev server.