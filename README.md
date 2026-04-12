# ring-core

Gaze-based nurse-call system for elderly patients. Patients communicate using eye gaze; nursing staff manage calls via a dashboard; families receive AI-generated summaries.

**Browser requirement:** Chrome 90+ or Edge 90+ (Web Speech API).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design and [docs/TECH_STACK.md](docs/TECH_STACK.md) for dependency details.

## Setup

1. Install dependencies

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in all required keys:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_EYEDID_LICENSE_KEY` — Eyedid/seeso gaze SDK license
- `NEXT_PUBLIC_FIREBASE_*` — Firebase project config (6 variables)
- `GEMINI_API_KEY` — Server-side Gemini API key (AI triage)

See [docs/TECH_STACK.md](docs/TECH_STACK.md) for the full variable list.

3. Start dev server

```bash
# PowerShell policy-safe
npm run dev:node
```

## Quality Commands

- Fast local check (gaze-related lint + tests):

```bash
npm run run:quality
```

- CI-equivalent full check with artifact log:

```bash
npm run run:verify
```

`run:verify` writes logs to `.artifacts/verify/`.

- Auto run on file change (app/components/hooks/lib/types):

```bash
npm run run:auto
```

`run:auto` runs `run:quality` once at startup, then reruns when target files change.

## CI

GitHub Actions workflow is in `.github/workflows/ci.yml` and runs:

1. `npm ci`
2. `npm run run:verify`
3. uploads `.artifacts/verify/**`
