# `@ring-open/core`

**ring Open Protocol (ROP)** — language-agnostic, framework-agnostic primitives for gaze-assisted communication, dwell selection, lightweight triage helpers, and sync abstractions.

- **Spec:** [`docs/spec/ROP-1.0.md`](../../docs/spec/ROP-1.0.md) (CC-BY-4.0)  
- **License:** Apache-2.0 (this package)  
- **Conformance:** See *Conformance Statement* in the spec (§11). This package **does not** grant rights to use the **“ring”** trade name or original logos.

## Install (npm org — planned)

```bash
npm install @ring-open/core@1.0.0-alpha.1
```

The `@ring-open` npm organization must be created by adult mentors; until then, use **npm workspaces** from the monorepo root (`"workspace:*"`).

## Quick start

```ts
import {
  selectDichotomyTarget,
  dwellProgress,
  computeNextProgress,
  stepTargetStability,
  initialStabilityState,
  matchKeywordPriority,
} from "@ring-open/core";

const target = selectDichotomyTarget({
  x: 100,
  y: 400,
  width: 800,
  height: 600,
  leftTarget: "bathroom",
  rightTarget: "conversation",
});

const p = dwellProgress(1200, 3500); // ~34% of dwell
const g = computeNextProgress(0, true);

let st = initialStabilityState<string>();
st = stepTargetStability(st, "bathroom");

const triage = matchKeywordPriority("chest pain", [
  { id: "chest", keywords: ["chest pain"], priority: 5 },
  { id: "water", keywords: ["water"], priority: 2 },
]);
```

## API surface (1.0.0-alpha)

| Module | Exports |
|--------|---------|
| `gaze/selection` | `selectDichotomyTarget`, `computeNextProgress`, `dwellProgress`, `dwellComplete` |
| `gaze/stability` | `stepTargetStability`, `initialStabilityState`, types |
| `gaze/dwell` | Re-exports dwell helpers |
| `triage/keywords` | `foldCompatibilityCase`, `collapseWhitespace` |
| `triage/priority` | `matchKeywordPriority`, `KeywordRule` |
| `sync/*` | Event payload types, `RealtimeSyncAdapter` |
| `i18n/types` | `LocaleBundle`, `LocalizedStringMap` |

## Publishing checklist (mentors)

1. Create npm org `@ring-open`.  
2. `npm login` with automation token (CI) or maintainer account.  
3. From `packages/ring-open-core`: `npm run build` then `npm publish --access public`.  
4. Tag Git release `core-v1.0.0-alpha.1` aligned with spec draft.

## Disclaimer

This software is **not** a medical device and **not** intended to diagnose, treat, cure, or prevent any disease. Implementers are responsible for regulatory compliance in their jurisdiction.
