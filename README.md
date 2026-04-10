# ring-core

Next.js 16 + Firebase + Eyedid(seeso) based gaze communication app.

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env.local` and set keys (at least Eyedid + Firebase)

- `NEXT_PUBLIC_EYEDID_LICENSE_KEY`
- `NEXT_PUBLIC_FIREBASE_*`
- `GEMINI_API_KEY` (for API routes)

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
