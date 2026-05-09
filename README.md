# ring-core

> **Communicate your needs — using only your gaze.**  
> A browser-based nurse-call and AI companion for elderly and acute-care settings.

**Live demo:** [https://ring-core2026.vercel.app](https://ring-core2026.vercel.app)

### Screenshots

| Patient (`/`) | Nurse (`/dashboard/nurse`) | Family (`/dashboard/family`) |
| :---: | :---: | :---: |
| ![Patient home](docs/assets/patient-home.svg) | ![Nurse dashboard](docs/assets/nurse-dashboard.svg) | ![Family dashboard](docs/assets/family-dashboard.svg) |

*Placeholders (SVG) in [`docs/assets/`](docs/assets/). For a polished submission, export real PNGs from the live app and swap paths—or follow [`docs/assets/README.md`](docs/assets/README.md).*

---

## English

### One-liner

**ring-core** lets patients call staff and talk with an AI **using only eye gaze**—no hands or voice required. Nurses see a live queue; families get AI summaries; the product is designed to **reduce documentation burden**, **support better care**, and **enable remote “visitation”** so patients stay more connected.

The default **patient UI is English**. Legacy Japanese labels in Firestore are normalized to English where applicable.

---

### Why it matters (contest framing)

| Stakeholder | Benefit |
|-------------|---------|
| **Patients** | Accessible control when speech or movement is limited; optional AI conversation after **Chat**. |
| **Nurses & caregivers** | Structured call reasons and priorities; less guesswork; trends visible on dashboards. |
| **Families** | Summaries and optional video messages support emotional connection and peace of mind. |

---

### Core features

| Area | What it does |
|------|----------------|
| **Gaze** | **MediaPipe iris path (default)** — in-browser face detection + gaze heuristics. **Eyedid (seeso)** — optional 5-point calibration (`NEXT_PUBLIC_EYEDID_LICENSE_KEY`). **Pointer / touch** — same two targets for demos or accessibility. |
| **Patient home (`/`)** | Dwell on **Restroom** or **Chat**; voice + AI triage after **Chat** when enabled. |
| **Staff / family** | Firestore-backed dashboards, signed invites, video-letter hooks (see routes). |
| **AI** | Gemini via server Route Handlers: `POST /api/chat` (REST via `fetch` + regex fallback) and `POST /api/family-summary` (`@google/genai` SDK). |

Deeper design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Stack detail: [docs/TECH_STACK.md](docs/TECH_STACK.md)
PoC docs (JA): [docs/poc-spec-contest-ja.md](docs/poc-spec-contest-ja.md) · [docs/poc-demo-checklist-ja.md](docs/poc-demo-checklist-ja.md) · [docs/poc-ops-runbook-ja.md](docs/poc-ops-runbook-ja.md)
Regression log (JA): [docs/regression-test-report-2026-04-27.md](docs/regression-test-report-2026-04-27.md)

---

### Technology (stack)

| Layer | Details |
|-------|---------|
| **App** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Gaze** | TensorFlow.js, self-hosted MediaPipe-style assets under `public/`, optional Eyedid (`seeso`) |
| **Data** | Firebase (Firestore, Storage as configured) |
| **AI** | Hybrid: `POST /api/chat` is REST (`fetch`), `POST /api/family-summary` is `@google/genai` SDK; both server-side with `GEMINI_API_KEY` |
| **Voice** | Web Speech API (Chrome / Edge) |
| **Quality** | Vitest, ESLint, `run:verify` (lint + tests + production build) |

---

### How to use (quick path for judges & demos)

1. **Run locally** — [Setup](#setup-local-development) → open `http://localhost:3000`.
2. **Patient** — On `/`, dwell gaze (or use pointer mode in `/settings`) on **Restroom** or **Chat**. Grant **camera** + **microphone** when asked.
3. **Staff** — Open `/nurse-login` (demo **ID `1` / password `1`** in dev—change for production), then `/dashboard/nurse` for the live queue.
4. **Family** — Staff-generated invites; family views under `/dashboard/family` and `/dashboard/history` after sign-in / token flow via `/login` and `/access?token=…`.

For a scripted demo, use `/demo` or `/demo-1min` if your deployment includes those routes.
The 60-second judge-friendly flow is available at [`/demo-1min`](http://localhost:3000/demo-1min) in local development.
`/demo-1min` also includes a **30-second post-demo survey** to collect implementation evidence (impact, trust, adoption intent).
Production demo links:
- [`https://ring-core2026.vercel.app/demo-1min`](https://ring-core2026.vercel.app/demo-1min) (60-second walkthrough)
- [`https://ring-core2026.vercel.app/demo`](https://ring-core2026.vercel.app/demo) (screen-record style demo page)

---

### URLs & routes

**Local:** `http://localhost:3000` (or `3010` / `3001` via npm scripts).  
**Production:** [https://ring-core2026.vercel.app](https://ring-core2026.vercel.app) (change if you use another host).  
**Git clone URL:** run `git remote -v` (often `https://github.com/<org>/<repo>.git`).

#### Docs & env (in-repo)

| Path | Purpose |
|------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data flow, gaze pipeline, AI paths |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Dependencies and env notes |
| [.env.example](.env.example) | Copy to `.env.local` (and mirror in Vercel env UI) |

#### Main pages

| Path | Purpose |
|------|---------|
| `/` | Patient — main gaze home (**Restroom** / **Chat**), links to settings & staff login |
| `/dashboard/nurse` | Nurse — live queue, patient cards, charts |
| `/dashboard` | Staff — manual care-log style entry to Firestore |
| `/dashboard/family` | Family — today’s snapshot, AI line, video upload, timeline |
| `/nurse-login` | Entry to nurse dashboard login → `/login` (**demo: `1` / `1`** in development) |
| `/settings` | Gaze vs pointer, iris vs Eyedid, tuning, camera |
| `/login` | Staff & family — credentials + invite token |
| `/access?token=…` | Invite landing → `GET /api/invite/consume` |
| `/dashboard/history` | Family — day-by-day history |
| `/demo` · `/demo-1min` | Demo-oriented pages |
| `/record` | Staff — activity / record UI |
| `/kiyoko` | Alternate simplified patient flow |

#### API (server)

| Endpoint | Role |
|----------|------|
| `POST /api/chat` | Gemini triage + JSON reply for voice flow |
| `POST /api/family-summary` | Family summary from posted call data |
| `POST /api/invite` | Create invite token (**nurse session required**) |
| `GET /api/invite/consume?token=…` | Validate token, set cookie, redirect |
| `POST /api/auth/nurse-login` · `POST /api/auth/logout` | Session cookie |
| `POST /api/auth/change-password` | Complete mandatory password update flow |
| `GET` / `POST /api/auth/hospital-switch` | Nurse hospital membership read/switch |
| `GET` · `POST` · `PATCH /api/nurse-accounts` | Account admin (**nurse session required**) |
| `GET /api/audit-logs` · `GET /api/audit-logs/export` | Audit log list + CSV export |
| `GET` / `POST /api/demo-feedback` | Stores and returns quick aggregate of 30-second survey results |

**External APIs (configure, not in repo):** Gemini Developer API (`GEMINI_API_KEY`) used from server Route Handlers (family summary uses `@google/genai`; chat route uses server API call and optional `GEMINI_API_BASE`). Firebase & Eyedid configured in their consoles.

**Static files:** e.g. `/@mediapipe/face_detection/…` from `public/@mediapipe/`.

---

### Setup (local development)

```bash
npm install
cp .env.example .env.local
# Set Firebase (NEXT_PUBLIC_*), GEMINI_API_KEY, APP_SIGNING_SECRET, optional Eyedid key

npm run dev:node
# Open http://localhost:3000
```

- **Other ports:** `npm run dev:3010` → port **3010**, `npm run dev:3001` → **3001**.  
- **LAN:** `npm run dev:lan` or `npm run dev:lan:node`.

---

### NPM scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` / `dev:node` | Dev server |
| `npm run build` | Production build |
| `npm run run:quality` | Gaze lint + unit tests |
| `npm run run:verify` | Full gate: lint + quality + **production build** (match CI) |
| `npm run run:auto` | Watch and re-run checks |

Logs: `.artifacts/verify/` (do not commit).

---

### Deployment

- Run `npm run build` or `npm run run:verify` before merging.  
- **Vercel:** mirror `.env.example` keys in the project dashboard. GitHub Actions deploys often need `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` as repository secrets.

---

### Default demo login (development only)

Nurse demo: **ID `1`** / **password `1`**. Replace or disable before any production use.

---

### Repository layout

```
ring-core/
├── app/           # Routes + API Route Handlers
├── components/    # UI (e.g. components/kiyoko — patient)
├── hooks/         # Gaze + voice
├── lib/           # gaze, calls, auth, …
├── public/        # Static assets (@mediapipe, …)
├── docs/          # Architecture & tech
└── tools/         # verify / quality runners
```

---

### Contest assets (recommended)

| Asset | Status / suggestion |
|-------|---------------------|
| **Screenshots** | **Placeholder SVGs** are in [`docs/assets/`](docs/assets/) and embedded at the [top of this README](#screenshots). Replace with PNG captures for the final pitch if you prefer real UI shots. |
| **Short video** | Optional: 30–60s (dwell → call → staff view); link from this README when ready. |
| **Architecture** | Optional: one diagram under `docs/` and link here. |

---

### CI

`.github/workflows/` runs `npm run run:verify` (or equivalent) on push/PR—run the same locally first.

---

## 日本語（概要）

**本番デモ:** [https://ring-core2026.vercel.app](https://ring-core2026.vercel.app)

### スクリーンショット（プレースホルダー）

| 患者 (`/`) | 看護 (`/dashboard/nurse`) | 家族 (`/dashboard/family`) |
| :---: | :---: | :---: |
| ![患者ホーム](docs/assets/patient-home.svg) | ![ナース画面](docs/assets/nurse-dashboard.svg) | ![家族画面](docs/assets/family-dashboard.svg) |

※ いまは SVG のプレースホルダーです。提出用に実画面の PNG に差し替える場合は [`docs/assets/README.md`](docs/assets/README.md) を参照。

### ring-core について

**ring-core** は、高齢者や急性期の患者向けの **視線入力型ナースコール** です。画面を見るだけでスタッフ呼び出しや AI 対話ができ、スタッフ用ダッシュボードと家族向け要約を備えています。**患者向け UI の既定言語は英語**です（Firestore に残る日本語ラベルは表示時に英語へ正規化されます）。ナースコールの内訳をトラッキングしていくことで、看護師・介護士の業務を軽減し、看護・介護の質の向上につなげます。オンラインお見舞い機能を通じてコミュニケーションをデザインし、患者の QOL 向上を目指します。

### ドキュメント・環境

| パス | 説明 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 構成とデータの流れ |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | 依存関係の詳細 |
| [.env.example](.env.example) | 環境変数テンプレート |

### 主な画面 URL（パス）

ローカルでは `http://localhost:3000`、本番の例では `https://ring-core2026.vercel.app` を前置してください（運用ホストは各自のデプロイに合わせて読み替えてください）。

| パス | 説明 |
|------|------|
| `/` | 患者メイン（Restroom / Chat） |
| `/dashboard/nurse` | 看護向けライブキュー |
| `/dashboard` | スタッフ入力ログ |
| `/dashboard/family` | 家族向けダッシュボード |
| `/nurse-login` | 看護ダッシュボード向けログイン入口（デモ ID/PASS は `1` / `1`） |
| `/settings` | 視線モード・エンジン・チューニング |
| `/login` | スタッフ・家族（ログイン・招待トークン） |
| `/access?token=…` | 招待リンク受け取り → consume へリダイレクト |
| `/dashboard/history` | 家族向け履歴 |
| `/demo` · `/demo-1min` | デモ用ページ |
| `/record` | 記録 UI |
| `/kiyoko` | 患者向け代替 UI |

### API（サーバー）

| パス | 役割 |
|------|------|
| `POST /api/chat` | AI トリアージ・応答 |
| `POST /api/family-summary` | 家族向け要約生成 |
| `POST /api/invite` | 招待トークン作成（要ナースセッション） |
| `GET /api/invite/consume?token=…` | トークン検証・セッション設定 |
| `POST /api/auth/nurse-login` · `POST /api/auth/logout` | ログイン・ログアウト |
| `GET` / `POST` / `PATCH /api/nurse-accounts` | アカウント管理（要ナースセッション） |

外部 API の例: **Gemini** 既定ベース `https://generativelanguage.googleapis.com/v1beta`（`GEMINI_API_BASE` で上書き可）。Firebase・Eyedid は各サービスのコンソールでプロジェクト／ライセンスを設定します。

### セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev:node
# ブラウザで http://localhost:3000
```

品質チェック: `npm run run:verify`（CI に近い一括ゲート）。

### ターミナルに出ていた差分について

Claude Code のターミナルに表示されていた **行番号付きの `+` 付きテキスト**は、提案パッチのプレビューです。**正として使うのはリポジトリ内の `README.md` 本体**で、内容を変えたいときは **エディタで `README.md` を直接書き換えて問題ありません**（その後 `git add` / `commit` すればよいです）。

### デモ・画像について

冒頭に **本番 URL** と **`docs/assets/` の 3 枚**（プレースホルダー SVG）を載せています。コンテスト本番では、実機の **PNG スクリーンショット**に差し替え、可能なら **30〜60 秒の操作動画**へのリンクを追加すると説得力が増します。手順は [`docs/assets/README.md`](docs/assets/README.md) を参照。