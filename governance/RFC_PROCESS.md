# RFC process — ROP normative changes

## When you need an RFC

You need an RFC before merging any change that:

- Alters **conformance levels** or the **privacy & ethics floor** in [`docs/spec/ROP-1.0.md`](../docs/spec/ROP-1.0.md), or  
- Introduces a **breaking** API change in `@ring-open/core`, or  
- Changes **trademark / branding** policy.

## How to propose

1. Open a **GitHub Discussion** with title `RFC-NNN: short title` (NNN = draft number).  
2. After one week of feedback, open a PR adding `docs/rfc/RFC-NNN-title.md` with: motivation, detailed design, migration, and conformance impact.  
3. **Lazy consensus:** 14 days without steering objection → merge as **Draft** in the spec.  
4. **Ratification:** steering committee marks RFC as **Accepted**; spec version bumps per semantic rules.

## Minor clarifications

Typos and purely informative examples may use a normal PR labelled `docs-clarification` without RFC.
