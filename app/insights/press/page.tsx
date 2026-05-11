"use client";

import Link from "next/link";
import { InsightsShell } from "@/components/insights/InsightsShell";

export default function PressPage() {
  return (
    <InsightsShell>
      {() => (
        <article className="prose prose-slate max-w-3xl">
          <h1>Press kit</h1>

          <p>
            <strong>ring</strong> is an open-source nurse-call platform built
            by a team of 11–16 year-old engineers in Japan as part of the
            Technovation Girls programme. It combines eye-gaze input, voice
            AI, and a public-health insights layer (PHIL) so that, for the
            first time, the data behind everyday nurse-call traffic can be
            seen and cited by researchers, policy-makers, and journalists.
          </p>

          <h2>Quick facts</h2>
          <ul>
            <li>
              <strong>Team:</strong> 11–16 year-old engineers, Japan
              (Technovation Girls 2026).
            </li>
            <li>
              <strong>License:</strong> code under MIT; PHIL aggregates under
              CC-BY-4.0.
            </li>
            <li>
              <strong>Headline observation:</strong> across observed days,{" "}
              <em>≈1.5–2% of nurse-call events</em> are flagged as
              high-priority (priority ≥ 4) by the triage engine. The remainder
              are routine assistance and conversational check-ins.
            </li>
          </ul>

          <h2>For interviews & data-team requests</h2>
          <ul>
            <li>
              Project mailbox:{" "}
              <a href="mailto:ring-press@example.org">ring-press@example.org</a>
            </li>
            <li>
              School-routed contact form: <em>(coming soon)</em>
            </li>
            <li>
              Public dataset API:{" "}
              <Link className="underline" href="/insights">
                /insights
              </Link>{" "}
              and{" "}
              <a className="underline" href="/api/v1/insights/aggregates">
                /api/v1/insights/aggregates
              </a>
            </li>
          </ul>

          <h2>Downloadable assets</h2>
          <p>
            The media kit lives under <code>docs/press/</code> in the project
            repository. Until we attach binary assets directly, please use
            the placeholders below:
          </p>
          <ul>
            <li>
              <code>ring_logo_dark.svg</code> / <code>ring_logo_light.svg</code>
            </li>
            <li>
              <code>ring_dashboard_screenshot_v1.png</code>
            </li>
            <li>
              <code>ring_one_pager_2026.pdf</code>
            </li>
            <li>
              <code>ring_press_release_template_en.md</code>
            </li>
            <li>
              <code>ring_press_release_template_ja.md</code>
            </li>
          </ul>

          <h2>Citation guidance</h2>
          <p>
            <em>
              ring Public Health Insights (PHIL), &lt;date of retrieval&gt;,
              retrieved from https://ring-core2026.vercel.app/insights.
              Licensed CC-BY-4.0.
            </em>
          </p>
        </article>
      )}
    </InsightsShell>
  );
}
