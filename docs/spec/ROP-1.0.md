# ring Open Protocol (ROP)

**Version:** 1.0-draft  
**Status:** Draft for community review  
**Last updated:** 2026-05-11  
**Document license:** [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)  
**Reference implementation:** *ring-core* (this repository) and the [`@ring-open/core`](../../packages/ring-open-core/) npm package (Apache-2.0).

---

## Abstract

The **ring Open Protocol (ROP)** defines a minimal, culturally adaptable architecture for **gaze-assisted (or equivalent) communication** between bed-bound or motor-limited people and care staff, optionally augmented by **AI triage** and **family presence**. ROP is intentionally **not** a medical device standard, a diagnostic protocol, or a substitute for clinical judgement. It is an **open interoperability and ethics floor** so that teams anywhere can **rebuild**—not merely translate—experiences that fit local language, family norms, and healthcare workflows.

---

## Table of contents

1. [Vision statement](#1-vision-statement)  
2. [Core concepts](#2-core-concepts)  
3. [Minimum viable implementation (MVP)](#3-minimum-viable-implementation-mvp)  
4. [Conformance levels](#4-conformance-levels)  
5. [Cultural adaptation guidelines](#5-cultural-adaptation-guidelines)  
6. [Privacy and ethics floor](#6-privacy-and-ethics-floor)  
7. [Security considerations](#7-security-considerations)  
8. [Data model and real-time sync (informative)](#8-data-model-and-real-time-sync-informative)  
9. [AI triage (informative)](#9-ai-triage-informative)  
10. [Versioning and change control](#10-versioning-and-change-control)  
11. [Conformance statement and branding](#11-conformance-statement-and-branding)  
12. [References (informative)](#12-references-informative)  

---

## 1. Vision statement

### 1.1 Why ROP exists

Assistive communication using **eye gaze, head pose, or dwell-based selection** is needed across borders: nursing homes, district hospitals, hospice, and home care. Commercial systems are often expensive, opaque, or culturally narrow. ROP exists so that **teen and adult developers**, **clinicians**, and **families** can implement systems that share a **common vocabulary of safety, privacy, and interoperability**—while retaining full control over UI, language, and local policy.

### 1.2 Who ROP is for

- **Young developers (especially ages 11–18)** learning to ship ethical software with mentor oversight.  
- **Local implementers** adapting flows to Spanish, Hindi, Swahili, Japanese, and beyond.  
- **Healthcare-adjacent organisations** piloting non-regulated communication aids (subject to local law).  
- **Researchers** comparing implementations under a shared conformance rubric.

### 1.3 What ROP is **not**

| ROP is **not** | Rationale |
|----------------|-----------|
| A **medical device** specification | Devices are regulated by national bodies (e.g. FDA, PMDA, EU MDR). ROP describes software patterns, not clinical claims. |
| A **diagnostic** or **treatment** tool | AI triage under ROP is **logistical prioritisation** for human responders, not diagnosis. |
| A **single vendor** stack | Implementations may use Firebase, Supabase, MQTT, WebSockets, or offline-first sync via the **adapter** pattern in `@ring-open/core`. |
| A **replacement** for informed consent or IRB review | Local ethics processes remain mandatory where research or identifiable health data is involved. |

---

## 2. Core concepts

### 2.1 Gaze input

**Gaze input** is any signal stream that estimates **where the user is looking** (or an anatomically correlated proxy such as head pose) in normalized screen coordinates and/or target identifiers.

**ROP requirement:** The implementation MUST document its input modality (camera model, IR eye tracker, touch fallback, switch access).

### 2.2 Dwell selection

**Dwell selection** confirms an intent by requiring the user to **maintain focus** on a target for a configurable duration before firing a `select` event.

**ROP requirement:** Dwell duration, hysteresis, and cancel behaviour MUST be configurable and documented.

### 2.3 AI triage

**AI triage** assigns a **discrete priority** (ROP uses integers **1–5** by convention: lower = routine, higher = urgent) to guide staff attention. Outputs MUST be explainable to a human responder in natural language **after** cultural localisation.

**ROP requirement:** A **non-AI fallback path** (rule-based or manual) MUST exist when the model is unavailable.

### 2.4 Real-time sync

**Real-time sync** propagates call events to authorised clients (nurse station, family app) with **low latency** and **integrity** (ordering, acknowledgement where implemented).

**ROP requirement:** Implementations MUST specify their transport and conflict strategy (e.g. server timestamps, CRDT, last-write-wins).

### 2.5 Family connection

**Family connection** is an optional channel for summaries, presence, or asynchronous messages **without** substituting clinical communication.

**ROP requirement:** Family features MUST be **opt-in** on both patient and facility sides where identifiable data is shown.

---

## 3. Minimum viable implementation (MVP)

An implementation MAY claim **ROP Level 1 (Basic)** if and only if all of the following hold:

1. **Target selection**  
   The user can select at least **two distinct call reasons** (e.g. *bathroom* and *conversation*) using **gaze or an equivalent modality** (touch, keyboard, switch scanning) with documented dwell or activation semantics.

2. **Staff notification**  
   Authorised staff receive a **real-time** indication of a new call (push, sound, dashboard row, or equivalent) including at minimum: **timestamp**, **reason identifier(s)**, and **priority** (numeric or categorical mapping to 1–5).

3. **Cultural UI**  
   All user-visible strings for the MVP flow are loaded from a **locale bundle** (JSON or structured resource); no hard-coded single-language assumption in the selection path.

4. **Privacy floor**  
   Section [6](#6-privacy-and-ethics-floor) is satisfied at **Level 1** scope (camera frames processed locally where a camera is used; PII minimisation; consent; auditability).

---

## 4. Conformance levels

| Level | Name | Summary |
|------|------|---------|
| **1** | Basic | MVP (§3) + privacy floor. |
| **2** | Standard | Level 1 + **AI triage** with fallback + **family connection** (opt-in) with documented data flows. |
| **3** | Advanced | Level 2 + **public health insight** contribution: anonymised aggregates only, **k-anonymity ≥ 5** for published buckets, documented methodology (see project PHIL docs). |

Conformance is **self-declared** with a public **Conformance Statement** (see §11). Third-party certification is out of scope for ROP 1.0.

---

## 5. Cultural adaptation guidelines

These guidelines are **non-normative** but implementations SHOULD document their choices in a `cultural-notes.md` file per locale (see `recipes/` in this repository).

### 5.1 Language and register

- **Japanese (ja-JP):** keigo (敬語) and soft hedging reduce perceived bluntness; avoid imperative-only copy for distressed users.  
- **Spanish (es-*):** `tú` vs `usted` choice MUST match facility policy; regional variants (e.g. `vosotros`) affect UI conjugation.  
- **Hindi (hi-IN):** honorific forms (`आप`) and gender agreement in adjectives; consider Devanagari font stack and mixed Latin/Hindi input.  
- **Swahili (sw-*):** politeness via `tafadhali` and plural `nyinyi` in group addressing; avoid colonial-era idioms in care contexts.

### 5.2 Colour, iconography, and gesture

- **White** as mourning in some East Asian contexts; **purple** as mourning in some Latin American contexts—validate palette per deployment.  
- **Hand icons** may be ambiguous or offensive; prefer **abstract shapes** or text-first affordances where uncertain.  
- **Religious time:** prayer times, Sabbath, Ramadan fasting—avoid scheduling intrusive prompts; document quiet hours.

### 5.3 Family structure assumptions

Do not assume a **nuclear family** default. Implementers SHOULD allow configurable **relationship labels** (spouse, sibling, neighbour, volunteer) and multiple contacts.

### 5.4 End-of-life and spiritual care

Copy MUST be **non-prescriptive** about belief. Offer **neutral reassurance** and defer to staff. Avoid theological claims in AI prompts.

---

## 6. Privacy and ethics floor

### 6.1 Camera and media

- **Local processing:** Where video is used for gaze estimation, frames SHOULD be processed **in-browser or on-device** without uploading raw video for model inference, unless explicit **separate** consent and legal basis exist.  
- **Retention:** Raw imagery MUST NOT be retained for ROP-conformant triage; derived features only.

### 6.2 PII minimisation

Collect only what is needed for **routing and accountability** (e.g. reason codes, timestamps, optional ward ID). **Names and transcripts** MUST be treated as high-risk PII and excluded from public aggregates.

### 6.3 Consent

Obtain **informed consent** appropriate to jurisdiction before enrolling patients in analytics, family features, or cloud persistence.

### 6.4 Audit log

Mutations to safety-critical state (priority changes, acknowledgements) SHOULD be append-only auditable events with server-side integrity controls.

### 6.5 Right to erasure

Provide a documented channel to request **deletion or recomputation** of derived data where technically feasible.

---

## 7. Security considerations

- Authenticate **staff channels**; never expose unauthenticated write paths to call state.  
- Rate-limit public research APIs.  
- Rotate API keys; never embed long-lived secrets in client bundles.

---

## 8. Data model and real-time sync (informative)

ROP does not mandate a single database. The reference package defines **event types** and a **sync adapter interface** so implementations can swap Firestore, Supabase, or custom backends. See `@ring-open/core` source under `src/sync/`.

---

## 9. AI triage (informative)

Suggested output schema (compatible with *ring-core*):

- `priority`: integer 1–5  
- `message`: localised short reassurance string  
- `summary` (optional): English or facility-defined language for logs  

Models MUST be instructed **not** to diagnose or prescribe.

---

## 10. Versioning and change control

### 10.1 Semantic versioning

- **Major:** incompatible security or ethics floor changes, or breaking API changes in `@ring-open/core`.  
- **Minor:** new optional features, new event types (backward compatible).  
- **Patch:** bug fixes.

### 10.2 Specification versioning

This document uses **ROP-x.y** aligned with `@ring-open/core` releases where practical.

### 10.3 RFC process

Normative changes to ROP (levels, ethics floor) require an **RFC** as described in [`governance/RFC_PROCESS.md`](../../governance/RFC_PROCESS.md). Draft specs may circulate on GitHub Discussions before RFC number assignment.

---

## 11. Conformance statement and branding

- Implementations MAY use the phrase **“ROP Compliant — Level N”** only if the implementation publishes a **Conformance Statement** listing: version, level, locale IDs, data processors, and AI model/fallback description.  
- **“ring”** as a product name and the original **ring** logos are **not** open generic marks; community forks SHOULD use distinct branding unless licensed.  
- **ROP** and **ring Open Protocol** are protocol names intended for **descriptive fair use** in documentation.

---

## 12. References (informative)

- WHO guidance on digital health interventions (high-level).  
- IETF RFC style for future ROP extensions (e.g. signed aggregate interchange).  
- Project-specific methodology: `docs/governance/PHIL_data_governance.md` and `/insights/methodology`.

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0-draft | 2026-05-11 | Initial integrated draft. |

---

## 日本語概要（妙訳・参考）

> 本節は英語本文の意図を損なわないよう訳出した概要です。**規範テキストは英語版に従います。** 解釈の食い違いがある場合は英語版を優先してください。

**ring Open Protocol（ROP）**は、寝たきえ・運動に制限のある方とケアスタッフのあいだで、**視線・頭部姿勢・滞留選択などの入力**を用いて意思を伝え、必要に応じて **AI による優先度付け** や **家族とのつながり** を添えられるようにするための、**最小限かつ文化適合可能なアーキテクチャ**を定めます。ROP はあくまで **オープンな相互運用と倫理の「床（フロア）」** を示すものであり、**医療機器の規格でも、診断・治療を目的としたプロトコルでも、臨床判断の代替でもありません。** 各国の開発者・医療に隣接する組織・家族が、**文言の翻訳にとどまらず、言語・家族観・医療現場の運用に合わせて体験を再構築できる**ことを目的とします。

実装が **ROP Level 1（Basic）** を名乗るには、少なくとも二つの通話理由の選択、スタッフへのリアルタイム通知、利用者向け文言のロケール分離、およびカメラ利用時のローカル処理・PII 最小化・同意・監査可能性など、本文 §6 に沿ったプライバシー下限を満たす必要があります。**Level 2** では AI トリアージとそのフォールバック、オプトインに基づく家族接続を追加します。**Level 3** では、公開可能な匿名集計（例: k 匿名性の確保、方法論の文書化）による公衆衛生インサイトへの貢献を想定します。なお **「ROP Compliant — Level N」** の表示には、バージョン・レベル・ロケール・データ処理者・AI／フォールバックの説明を載せた **適合宣言（Conformance Statement）** の公開が求められます。**「ring」という製品名および従来のロゴは汎用のオープンマークではありません**（コミュニティ版は別ブランドを推奨）。**ROP / ring Open Protocol** という名称は、文書における **記述的フェアユース** を意図しています。

---

*End of ROP 1.0 draft.*
