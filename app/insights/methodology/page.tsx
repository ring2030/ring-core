"use client";

import Link from "next/link";
import { InsightsShell } from "@/components/insights/InsightsShell";

export default function MethodologyPage() {
  return (
    <InsightsShell>
      {() => (
        <article className="prose prose-slate max-w-3xl">
          <h1>Methodology</h1>

          <p>
            <em>
              Draft of the Methods section for a forthcoming paper on
              elderly-care alarm fatigue and AI-assisted nurse-call triage.
              Comments to the project lead are welcome — see the{" "}
              <Link href="/insights/ethics">ethics page</Link> for the contact channel.
            </em>
          </p>

          <h2>1. Data source</h2>
          <p>
            The <strong>ring</strong> platform records every nurse-call event
            into a per-call document in a Firebase Firestore collection
            (<code>calls</code>). Each document carries:
          </p>
          <ul>
            <li>
              <code>createdAt</code> — server timestamp (UTC) of when the
              patient initiated the call (via gaze or voice).
            </li>
            <li>
              <code>priority</code> — integer 1–5 from the AI triage engine
              (see <code>app/api/chat/route.ts</code>: prompts, fallback rules,
              and the local rule-based safety net are open source).
            </li>
            <li>
              <code>reasonCodes</code> — normalized English category labels
              (<code>lib/calls/reasons.ts</code>).
            </li>
            <li>
              <code>hospitalId</code> — internal identifier, used only to count
              unique participating facilities; never published.
            </li>
            <li>
              <code>responseTimeSec</code> — optional, when measured: seconds
              between call creation and nurse acknowledgement.
            </li>
          </ul>

          <h2>2. Anonymization pipeline</h2>
          <p>
            A nightly Cloud-Function job (<code>/api/cron/aggregate-phil</code>,
            scheduled at 00:05 UTC) reads the previous UTC day&apos;s calls via the
            Firebase Admin SDK and applies the following pipeline before
            writing anything to the public <code>phil_aggregates</code>{" "}
            collection:
          </p>
          <ol>
            <li>
              <strong>PII strip:</strong> only{" "}
              <code>createdAt</code>, <code>priority</code>,{" "}
              <code>reasonCodes</code>, <code>hospitalId</code>, and{" "}
              <code>responseTimeSec</code> are read. Free-text fields
              (transcripts, summaries, sender names, notes) are never loaded
              into the aggregator.{" "}
            </li>
            <li>
              <strong>Counting:</strong> we compute per-priority counts, hourly
              UTC histograms, and reason-category counts.
            </li>
            <li>
              <strong>k-anonymity (k=5):</strong> any reason category with
              fewer than 5 observations on the day is removed from the
              published bucket; its members are aggregated into a single{" "}
              <code>__suppressed__</code> entry that exposes only the total
              count of suppressed members.
            </li>
            <li>
              <strong>Statistical envelopes:</strong> binomial proportions
              (emergency rate, AI-completion rate) are reported with their
              Wilson 95% confidence intervals. Response-time stats are
              reported as median, p90, p95.
            </li>
            <li>
              <strong>Sample-size flag:</strong> documents with fewer than 30
              observations are marked{" "}
              <code>insufficient_sample: true</code>, and the public dashboard
              hides point estimates from these rows.
            </li>
            <li>
              <strong>Hospital identifiers:</strong> only the cardinality of
              the participating-facilities set is published. Hospital IDs are
              held only in the cron job&apos;s transient memory and never written
              to the public document.
            </li>
          </ol>

          <h2>3. Statistical methods</h2>
          <ul>
            <li>
              <strong>Binomial CIs:</strong> Wilson (1927) score interval, as
              recommended by Newcombe (1998) for small samples and proportions
              near 0 or 1. Implementation in{" "}
              <code>lib/stats/confidenceInterval.ts</code>.
            </li>
            <li>
              <strong>Percentiles:</strong> Hyndman–Fan type 7 (linear
              interpolation), matching NumPy / R defaults. Implementation in{" "}
              <code>lib/stats/percentile.ts</code>.
            </li>
            <li>
              <strong>Trend tests (planned):</strong> Cochran–Armitage trend
              test for ordered priority distributions over time, once a
              ≥90-day window is available.
            </li>
          </ul>

          <h2>4. Known limitations</h2>
          <ul>
            <li>
              <strong>Selection bias:</strong> the participating facilities are
              early adopters of gaze / voice nurse-call interfaces; their
              patient mix is unlikely to be representative of all nursing-care
              populations. We will publish facility-level characteristics in
              aggregate form once enough partners join (n ≥ 10).
            </li>
            <li>
              <strong>Triage measurement:</strong> the priority value is
              produced by an AI triage model (Gemini 2.5 Flash by default,
              with a hand-coded fallback). The &ldquo;1.5% emergency&rdquo;
              headline should therefore be read as{" "}
              <em>
                &ldquo;the proportion of calls the triage engine classified as
                priority ≥ 4.&rdquo;
              </em>{" "}
              Validation
              against clinician adjudication is a planned follow-up study.
            </li>
            <li>
              <strong>Response time:</strong> currently only reported when
              partner facilities instrument acknowledgement events. Coverage
              is partial.
            </li>
            <li>
              <strong>Diurnal effects:</strong> we publish hourly histograms
              in UTC; consumers should shift to local time when interpreting.
            </li>
          </ul>

          <h2>5. Ethics</h2>
          <p>
            See the dedicated{" "}
            <Link href="/insights/ethics">ethics and governance page</Link>{" "}
            for the consent template, partner-hospital policy, and the
            data-deletion request channel.
          </p>

          <h2>6. Reproducibility</h2>
          <p>
            All aggregation code, statistical helpers, and the public API
            handler are open source in the{" "}
            <a href="https://github.com/" rel="noreferrer">
              ring-core
            </a>{" "}
            repository under the following paths:
          </p>
          <ul>
            <li>
              <code>lib/phil/aggregate.ts</code> — pure aggregator
            </li>
            <li>
              <code>lib/stats/confidenceInterval.ts</code> — Wilson CIs
            </li>
            <li>
              <code>lib/stats/quality.ts</code> — k-anonymity + reliability
              flags
            </li>
            <li>
              <code>app/api/cron/aggregate-phil/route.ts</code> — daily writer
            </li>
            <li>
              <code>app/api/v1/insights/aggregates/route.ts</code> — public
              JSON API
            </li>
          </ul>
        </article>
      )}
    </InsightsShell>
  );
}
