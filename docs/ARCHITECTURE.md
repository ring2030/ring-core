# Architecture

## Overview

ring-core is a gaze-based nurse-call system for elderly patients. A patient using eye gaze selects an action; the system triages the request via AI and notifies nursing staff via a shared dashboard.

```
Patient (eye gaze)
       │
       ▼
┌─────────────────────────────────┐
│  app/page.tsx (gaze interface)  │
│  - Eyedid SDK (WebAssembly)     │
│  - Gaze → target → progress    │
│  - Voice conversation (Gemini)  │
└──────────────┬──────────────────┘
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
| `/` | Patient | Gaze interface — トイレ / お話 |
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
Eyedid SDK (WASM)
      │ gaze (x, y) @ ~60fps
      │ throttled to 16ms
      ▼
useEyedidGaze hook
      │ onGazePoint(x, y)
      ▼
selectGazeTarget()           ← lib/gaze/selection.ts
      │ raw hit: "トイレ" | "お話" | null
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
      ├─ "トイレ" → Firestore write → success screen (5s) → reset
      └─ "お話"   → Firestore write → VoiceTriageModal (Gemini conversation)
```

## AI Triage Flow

```
VoiceTriageModal
  │  Web Speech API (ja-JP, continuous)
  │  debounce: 3.5s silence after last phrase
  ▼
POST /api/chat
  │  Gemini 2.5 Flash
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
```

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
├── EyedidCalibrationOverlay   — calibration UI (5-point dot sequence)
├── SleepOverlay               — power-save mode (10s idle)
├── GazeHalo                   — visual cursor dot
├── ConversationView           — AI chat UI (isSuccess + sentReason==="お話")
│   └── VoiceTriageModal       — voice input + AI response display
├── GazeTargetPanel            — トイレ / お話 buttons with dwell gauge
│   ├── GazeHoverSurface (left)
│   └── GazeHoverSurface (right)
├── TuningPanel                — gaze parameter tuning drawer
├── StatusBar                  — tracking state / error message
├── ElderVideoLetterOverlay    — family video message popup
└── NavigationBar              — links to staff/family pages
```

## Key Hooks

### `useEyedidGaze` ([hooks/useEyedidGaze.ts](../hooks/useEyedidGaze.ts))
Wraps the Eyedid/seeso WebAssembly SDK. Manages:
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
Required for Eyedid's WebAssembly threads (SharedArrayBuffer). Applied on `/`:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```
**Warning:** These headers break some browser extensions (e.g. password managers).

### Browser Requirements
- Chrome 90+ or Edge 90+ (Web Speech API)
- Camera access (getUserMedia)
- localStorage (calibration cache)
- SharedArrayBuffer support (COOP/COEP headers required)

### Calibration Cache
- Key: `kiyoko_eyedid_cal_v1` (calibration data string)
- Key: `kiyoko_cal_ts` (timestamp)
- TTL: 24 hours
- Logic: [lib/gaze/eyedidStorage.ts](../lib/gaze/eyedidStorage.ts)
