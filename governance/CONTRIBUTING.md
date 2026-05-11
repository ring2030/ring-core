# Contributing to ring & the ring Open Protocol (ROP)

Thank you for helping make gaze-assisted communication **rebuildable** in every language and culture.

## Where to start

1. Read [`docs/spec/ROP-1.0.md`](../docs/spec/ROP-1.0.md) (spec, CC-BY-4.0).  
2. Read this repository’s [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — **especially the child-safety addendum.**  
3. Skim [`packages/ring-open-core/README.md`](../packages/ring-open-core/README.md) for the language-neutral core.

## Ways to contribute

- **Spec & docs:** typos, clarifications, translations of *non-normative* sections (normative English source stays in `docs/spec/` until RFC says otherwise).  
- **Core (`@ring-open/core`):** pure functions, tests, no framework imports.  
- **Recipes:** add or improve `recipes/<locale>/locale.json` + `cultural-notes.md`. Spanish, Hindi, and Swahili starter folders welcome—copy from `es-mx-mexico` template.  
- **Academy:** lesson fixes, diagrams, localised lesson forks under `academy/` (see lesson README for bilingual policy).  
- **Reference app (`ring-core`):** bugfixes and features that **do not** weaken privacy defaults.

## Pull-request checklist

- [ ] No secrets committed.  
- [ ] `npm run test:run` passes.  
- [ ] `npx tsc --noEmit` passes.  
- [ ] `npm run lint` passes.  
- [ ] If you changed ROP normative text, an RFC exists (see [`RFC_PROCESS.md`](./RFC_PROCESS.md)).

## Trademark note

You may advertise **“ROP Compliant — Level N”** per the spec. You may **not** imply official affiliation with the **“ring”** product name or logos unless separately permitted.
