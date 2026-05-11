# PHIL Data Governance

**Document version:** 1.0 (2026-05-11)
**Owner:** ring project lead
**Status:** Living document — review at each new hospital onboarding.

---

## 1. Purpose

The Public Health Insight Layer (PHIL) takes the daily stream of nurse-call
events captured by the ring platform and publishes **anonymized, aggregated
counts and proportions** so that researchers, policy-makers, and journalists
can cite ring's observations without ever touching individual records.

This document describes PHIL's data lifecycle end to end. It is intended for
two audiences:

1. **Hospital partners** evaluating ring for clinical use.
2. **IRBs / data-protection officers** reviewing ring's research scope.

---

## 2. Data lifecycle at a glance

```
[Patient initiates call]
        │  gaze / voice  (Web Speech, MediaPipe iris)
        ▼
[Firestore: calls]      ← raw, PII-bearing, hospital-scoped (private)
        │   nightly cron, 00:05 UTC
        │   firebase-admin SDK, lib/phil/firestoreReader.ts
        ▼
[Pure aggregator]       ← lib/phil/aggregate.ts
        │   PII strip + k-anonymity (k=5) + Wilson CIs
        ▼
[Firestore: phil_aggregates]   ← anonymized, world-readable (CC-BY-4.0)
        │
        ├── /insights              public dashboard (Recharts)
        ├── /insights/[date]       per-day details
        └── /api/v1/insights/...   JSON API (CORS, rate-limited)
```

Every transition that *crosses a privacy boundary* — i.e. the cron read and
the cron write — is logged via the existing audit pipeline
(`lib/audit/auditLog.ts`).

---

## 3. Collection-level controls

### 3.1 `calls` (private)

- **Read:** authenticated hospital staff only, per the existing app rules.
- **Write:** patient-side clients and triage AI route.
- **Retention:** governed by partner-hospital policy (typically 30 days
  on-line; longer offline storage out of scope for PHIL).

### 3.2 `phil_aggregates` (public)

- **Read:** unauthenticated. Documents contain only counts and proportions.
- **Write:** server-only via firebase-admin in the cron job.
- **Schema:** see `lib/phil/schema.ts`; version pinned via
  `schema_version` field.
- **Retention:** indefinite. Documents are addressable by ISO date and
  recomputable if a deletion request requires it.

---

## 4. Anonymization controls

| Control | Implementation | Reference |
|---|---|---|
| PII strip on read | Aggregator never loads `senderName`, `transcript`, `aiSummary`, `note` / `特記事項`. | `lib/phil/firestoreReader.ts` |
| Hospital de-identification | Hospital IDs are used to count *distinct* facilities and then discarded. | `lib/phil/aggregate.ts` |
| k-anonymity (k = 5) | Reason buckets with < 5 events are merged into `__suppressed__`. | `lib/stats/quality.ts` |
| Sample-size suppression | Aggregates with n < 30 carry `insufficient_sample: true`; the dashboard hides point estimates. | `lib/stats/quality.ts` |
| Statistical envelopes | Wilson 95% CIs reported alongside every proportion. | `lib/stats/confidenceInterval.ts` |
| Opt-out at source | Patient consent is captured at intake; calls flagged `excludeFromPhil: true` are filtered out before the aggregator. | (planned, blocked on partner) |

---

## 5. Consent model (partner hospitals)

When a hospital onboards onto ring:

1. **Plain-language explainer** (JA / EN) given to every patient at intake.
2. **One-page consent form** confirms inclusion in PHIL. Defaults to *opt-in
   with deferred consent*, configurable per hospital.
3. **Opt-out channel** documented on `/insights/ethics`.
4. **Audit log** records consent state at the per-patient level (private,
   never published).

A template of the consent form is maintained alongside this document at
`docs/governance/consent_template.md` (placeholder; to be drafted with the
first partner IRB).

---

## 6. Data subject rights

- **Right to access:** patients may ask which calls were attributed to them
  (handled inside the private nurse dashboard, not via PHIL).
- **Right to deletion / withdrawal:** see `/insights/ethics`. Affected
  daily aggregates are recomputed and republished.
- **Right to object to research:** opt-out flag flows into the aggregator
  filter (see §4).

---

## 7. International transfers

PHIL data is hosted on Google Cloud / Firebase (region: as configured per
deployment). The published aggregates contain no personal data and may be
freely fetched from any region. Raw `calls` data does not leave the
hospital-scoped project boundary.

---

## 8. Open questions / TODO

- Formal IRB submission with the first partner hospital.
- Draft of `consent_template.md` (JA + EN).
- Decide on minimum hospital-count threshold before publishing
  hospital-stratified breakdowns (we suggest n ≥ 10 facilities).
- Decide on a long-term archival cadence and durable identifiers (DOI?) for
  major dataset versions.
