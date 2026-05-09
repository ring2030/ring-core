export const metadata = {
  title: "Privacy & Ethics — ring",
  description: "How ring handles patient data, camera frames, and AI inference.",
};

export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Camera frames stay on the device",
      body: (
        <>
          In the default mode, all face-detection and gaze tracking runs inside
          the patient&apos;s browser using MediaPipe.{" "}
          <strong>Video frames are never transmitted to any server.</strong>{" "}
          Only the user&apos;s selection (e.g. &ldquo;Restroom&rdquo;) is sent to the call queue.
        </>
      ),
    },
    {
      title: "2. Explicit consent & minimum data",
      body: (
        <>
          Camera and microphone permissions are requested using standard
          browser APIs. We store only call events, AI summaries, and
          (optionally) family video letters - there is no continuous video
          recording or long-term audio retention.
        </>
      ),
    },
    {
      title: "3. Access control & auditability",
      body: (
        <>
          Each hospital&apos;s data is isolated. Staff access is gated by role-based
          access control, session cookies, and mandatory password rotation on
          first login. All sensitive operations are written to a tamper-evident
          audit log accessible only via authenticated admin routes.
        </>
      ),
    },
    {
      title: "4. AI reliability",
      body: (
        <>
          When AI triage is invoked, a local rule-based fallback always runs as
          a safety net so the system continues to triage even if the AI service
          is unavailable. Avoiding silent failure modes matters in a
          safety-relevant context.
        </>
      ),
    },
    {
      title: "5. Research use",
      body: (
        <>
          When data is exported for policy advocacy or academic study,
          identifying fields are removed and records are aggregated. Raw
          patient records never leave the hospital scope.
        </>
      ),
    },
    {
      title: "6. Built by minors, with adult mentorship",
      body: (
        <>
          Our development team includes minors (ages 11-16). All code touching
          sensitive data has been reviewed by adult mentors before deployment,
          and privacy decisions were discussed with healthcare professionals.
        </>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-3">Privacy &amp; Ethics by Design</h1>
      <p className="text-gray-600 mb-10 text-lg leading-relaxed">
        ring is built for elderly and acute-care patients. We took the privacy
        and ethical questions that come with that seriously, from day one.
      </p>
      {sections.map((s) => (
        <section key={s.title} className="mb-7">
          <h2 className="text-xl font-semibold mb-2 text-gray-900">{s.title}</h2>
          <p className="text-gray-700 leading-relaxed">{s.body}</p>
        </section>
      ))}
      <hr className="my-10 border-gray-200" />
      <p className="text-sm text-gray-500">
        Questions about how ring handles your data? Contact your hospital&apos;s
        ring administrator, or open an issue in our public repository.
      </p>
    </main>
  );
}
