"use client";

import { InsightsShell } from "@/components/insights/InsightsShell";

export default function EthicsPage() {
  return (
    <InsightsShell>
      {() => (
        <article className="prose prose-slate max-w-3xl">
          <h1>Ethics & data governance</h1>

          <p>
            ring is operated by a team of student engineers in Japan. The
            public Insights layer (PHIL) is intentionally separate from the
            in-facility nurse-call system: PHIL only ever sees{" "}
            <strong>anonymized counts and proportions</strong>, never
            individuals.
          </p>

          <h2>What we do not publish</h2>
          <ul>
            <li>Patient names, IDs, room numbers, or photographs.</li>
            <li>Voice transcripts or AI summaries from any call.</li>
            <li>Per-hospital, per-ward, or per-nurse breakdowns.</li>
            <li>
              Any reason-category bucket with fewer than 5 observations on the
              day (k = 5 k-anonymity, per Sweeney 2002).
            </li>
            <li>
              Aggregates whose sample size is below 30 are flagged{" "}
              <code>insufficient_sample</code> and point estimates are hidden.
            </li>
          </ul>

          <h2>Patient consent (partner hospitals)</h2>
          <p>
            When a hospital onboards onto ring, every patient receives a
            two-page plain-language explainer in their preferred language (JA
            / EN), and a one-page consent form that covers:
          </p>
          <ul>
            <li>
              <strong>Purpose:</strong> &ldquo;your anonymous call events may
              be included in a public research dataset published by
              ring.&rdquo;
            </li>
            <li>
              <strong>Scope:</strong> only the timing, priority, and category
              of calls are shared; no voice, transcripts, or identifiers.
            </li>
            <li>
              <strong>Opt-out:</strong> patients can opt out at any time
              without affecting their care. We honour opt-outs at the source
              (calls flagged <code>excludeFromPhil: true</code> are never read
              by the aggregator).
            </li>
            <li>
              <strong>Withdrawal:</strong> deletion requests are honoured
              retroactively where technically feasible — see below.
            </li>
          </ul>
          <p>
            A template of this consent form is part of the data-governance
            packet (<code>docs/governance/PHIL_data_governance.md</code>).
          </p>

          <h2>Data deletion requests</h2>
          <p>
            If you are a patient, family member, or hospital administrator
            and you believe data that should not have been published was
            included, contact us at{" "}
            <a href="mailto:ring-privacy@example.org">ring-privacy@example.org</a>{" "}
            with the date(s) in question. We will:
          </p>
          <ol>
            <li>Acknowledge within 5 business days.</li>
            <li>
              Confirm whether the data is present in the aggregator (without
              revealing identifying information).
            </li>
            <li>
              Where required, recompute and republish the affected daily
              aggregate(s) under the same date key.
            </li>
            <li>
              Log the action in an internal audit log (server-side only).
            </li>
          </ol>

          <h2>Ethics review</h2>
          <p>
            ring&apos;s public Insights project is designed to fit within the
            scope of low-risk public-health research under the standard
            Japanese{" "}
            <em>
              Ethical Guidelines for Medical and Health Research Involving
              Human Subjects
            </em>{" "}
            (Ministry of Health, Labour and Welfare / MEXT). When the project
            partners with a hospital we file a research protocol with that
            hospital&apos;s institutional review board (IRB) and incorporate
            any additional constraints into{" "}
            <code>lib/phil/aggregate.ts</code> (e.g. tighter k, smaller
            publishable date windows).
          </p>

          <h2>Licensing</h2>
          <p>
            All published aggregates are released under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer">
              Creative Commons Attribution 4.0 International (CC-BY-4.0)
            </a>
            . You may reuse the data with attribution to{" "}
            <em>ring Public Health Insights</em>.
          </p>
        </article>
      )}
    </InsightsShell>
  );
}
