# Recipe: `ja-JP` — Japan (reference)

This recipe reflects the **original ring** cultural defaults: high-context politeness, keigo-friendly copy, and family-involved elder care norms common in Japanese hospitals.

## Files

- `locale.json` — UI strings + triage keyword hints (not a full clinical taxonomy).  
- `cultural-notes.md` — design rationale.  
- `README.md` — how to adopt.

## Conformance

Targeting **ROP Level 2** when combined with AI triage + Firestore sync as in `ring-core`.

## Demo

Run the upstream `ring-core` reference deployment; configure this `locale.json` as the string source of truth in your fork.
