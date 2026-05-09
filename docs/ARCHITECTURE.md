# Architecture
## Overview
ring-core is a gaze-based nurse-call system for elderly patients. A patient using eye gaze selects an action; the system triages the request via AI and notifies nursing staff via a shared dashboard.
```
Patient (eye gaze)
       │
       ▼
┌───────────────────────────────────────────┐
│  app/page.tsx (gaze interface)            │
│  - Default: MediaPipe iris (TF.js)        │
│  - Optional: Eyedid SDK (WebAssembly)     │
│  - Gaze → target → progress               │
│  - Voice conversation (Gemini via REST)   │
└─────────────────┬─────────────────────────┘
                  │ addDoc (Firestore)
                  ▼
       ┌───────────────────────┐
       │  Firestore: "calls"   │
       └──────────┬────────────┘
                  │ realtime listener
                  ▼
       ┌──────────────────────────────────┐
       │  app/dashboard/nurse/page.tsx    │
       │  Staff view — incoming calls     │
       └──────────────────────────────────┘
```
## Pages
| Route | Who uses it | Purpose |
|-------|------------|---------|
| `/` | Patient | Gaze interface — Restroom / Chat |
| `/kiyoko` | Patient (simplified) | Alternate gaze UI |
| `/dashboard` | Staff | Manual care-record entry |
| `/dashboard/nurse` | Nurse | Incoming call queue |
| `/dashboard/family` | Family | Summary view |
| `/dashboard/history` | Staff | Call history |
| `/settings` | Staff/Admin | Configuration |
| `/demo` | Demo | Screen recording demo |
| `/record` | Staff | Call log |
## Gaze Pipeline
```
Gaze engine (one of):
  - Default:  MediaPipe iris (TF.js + public/@mediapipe/)  → useMediaPipeGaze hook
  - Opt-in:   Eyedid SDK (WebAssembly, seeso)              → useEyedidGaze hook
      │ both hooks emit onGazePoint(x, y), throttled to ~16ms
      ▼
selectGazeTarget()           ← lib/gaze/selection.ts
      │ raw hit: "Restroom" | "Chat" | null
      ▼
stepTargetStability()        ← lib/gaze/selection.ts
      │ debounce: needs N consecutive frames to lock
      ▼
target (locked)
      │
      ▼
computeNextProgress()        ← lib/gaze/selection.ts
      │ dwell gauge: 0→100 over ~2s
      ▼
progress === 100 → submitCall()
      │
      ├─ "Restroom" → Firestore write → success screen (5s) → reset
      └─ "Chat"     → Firestore write → VoiceTriageModal (Gemini REST conversation)
```
## AI Triage Flow
```
VoiceTriageModal
  │  Web Speech API (ja-JP, continuous)
  │  debounce: 3.5s silence after last phrase
  ▼
POST /api/chat
  │  Gemini 2.5 Flash via REST (server-side fetch)
  │  System prompt: Japanese elder care context
  │  responseSchema: { response, summary, priority }
  │  Fallback: localTriage() regex if Gemini fails
  ▼
TriageResponse { response, summary, priority: 1–5 }
  │
  ├─ priority ≥ 4 → speakAndFinish (nurse dispatched)
  └─ priority < 4 → speakAndListen (continue conversation)
  │
  ▼
updateDoc(calls/{id}, { 要約, 緊急度 })

POST /api/family-summary
  │  @google/genai SDK (GoogleGenAI.models.generateContent)
```
## Audit Log Persistence
Operational events flow through `lib/audit/auditLog.ts` and are written by the Firebase Admin SDK to the `audit_logs` Firestore collection.
```
appendAuditEvent / listAuditEvents
        │
        ▼
firebase-admin (Service Account JSON or split env vars)
        │
        ▼
Firestore: audit_logs   ── where(hospitalId,==,X).orderBy(at,desc).limit(N)
        │
   (production: fail-fast on Firestore errors,
    structured JSON `level=error scope=audit` log line)
        │
   (dev/test only: JSONL fallback at <cwd>/.data/audit-log.jsonl)
```
Server-only access is enforced by `firestore.rules` (`audit_logs` is `allow read, write: if false`); the `/api/audit-logs` and `/api/audit-logs/export` routes are the only sanctioned read paths.
## Firestore Data Model
### `calls` collection
| Field | Type | Description |
|-------|------|-------------|
| `理由` | string \| string[] | Reason for call (e.g. "トイレ", "お話") |
| `特記事項` | string | Notes / transcript |
| `送信者` | string | Sender name (e.g. "きよ子") |
| `送信日時` | Timestamp | Server timestamp |
| `ステータス` | string | "未対応" (pending) |
| `要約` | string | AI-generated summary (added after triage) |
| `緊急度` | number | Priority 1–5 (added after triage) |
| `認識文` | string | Voice transcript (optional) |
### `messages` collection (configurable via `NEXT_PUBLIC_VIDEO_MESSAGES_COLLECTION`)
Video letters from family members. Displayed as overlay on the patient screen.
## Component Tree (gaze interface)
```
app/page.tsx  (GrandmaGazePage)
├── EyedidCalibrationOverlay   — calibration UI, 5-point dot sequence (Eyedid path only)
├── SleepOverlay               — power-save mode (10s idle)
├── GazeHalo                   — visual cursor dot
├── ConversationView           — AI chat UI (isSuccess + sentReason === "Chat")
│   └── VoiceTriageModal       — voice input + AI response display
├── GazeTargetPanel            — Restroom / Chat buttons with dwell gauge
│   ├── GazeHoverSurface (left)
│   └── GazeHoverSurface (right)
├── TuningPanel                — gaze parameter tuning drawer
├── StatusBar                  — tracking state / error message
├── ElderVideoLetterOverlay    — family video message popup
└── NavigationBar              — links to staff/family pages
```
## Key Hooks
### `useMediaPipeGaze` (default path) ([hooks/useMediaPipeGaze.ts](../hooks/useMediaPipeGaze.ts))
In-browser face / iris detection via TensorFlow.js with self-hosted MediaPipe-style assets under `public/@mediapipe/`. Manages:
- TF.js backend init and asset loading
- Camera permission gating
- No calibration step required
- Sleep mode (stops camera when idle, resumes on gaze)
- Gaze callbacks throttled to ~16ms
### `useEyedidGaze` (opt-in) ([hooks/useEyedidGaze.ts](../hooks/useEyedidGaze.ts))
Wraps the Eyedid/seeso WebAssembly SDK. Enabled when `NEXT_PUBLIC_EYEDID_LICENSE_KEY` is set and selected in `/settings`. Manages:
- SDK initialization & license validation
- Camera permission gating
- Calibration (1–5 point, 24h cached in localStorage)
- Sleep mode (stops camera when idle, resumes on gaze)
- Gaze callbacks throttled to 16ms
### `useAudio` ([lib/useAudio.ts](../lib/useAudio.ts))
Web Audio API wrapper. Plays "pon" (submit) and "ping-pong" (alert) sounds.
Handles browser autoplay restrictions via AudioContext resume on user interaction.
## Critical Infrastructure
### COOP/COEP Headers ([next.config.ts](../next.config.ts))
**No longer set.** Earlier builds applied `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` on `/` to enable `SharedArrayBuffer` for Eyedid's WebAssembly threads. The current Eyedid build (and the default MediaPipe path) do not require this, so the headers were dropped to avoid breaking browser extensions (notably password managers). See the comment in `next.config.ts` for context.
### Browser Requirements
- Chrome 90+ or Edge 90+ (Web Speech API)
- Camera access (getUserMedia)
- localStorage (calibration cache, when Eyedid path is enabled)
### Calibration Cache (Eyedid path only)
The default MediaPipe iris path needs no calibration. When the Eyedid path is enabled, calibration data is cached locally:
- Key: `kiyoko_eyedid_cal_v1` (calibration data string)
- Key: `kiyoko_cal_ts` (timestamp)
- TTL: 24 hours
- Logic: [lib/gaze/eyedidStorage.ts](../lib/gaze/eyedidStorage.ts)