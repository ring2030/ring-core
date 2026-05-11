"use client";

import { InsightsShell } from "@/components/insights/InsightsShell";

const REFERENCES = [
  {
    section: "Alarm fatigue & nuisance alerts",
    entries: [
      "Cvach, M. (2012). Monitor alarm fatigue: An integrative review. Biomedical Instrumentation & Technology, 46(4), 268–277.",
      "Sendelbach, S., & Funk, M. (2013). Alarm fatigue: A patient safety concern. AACN Advanced Critical Care, 24(4), 378–386.",
      "Drew, B. J., Harris, P., Zègre-Hemsey, J. K., Mammone, T., Schindler, D., Salas-Boni, R., ... & Hu, X. (2014). Insights into the problem of alarm fatigue with physiologic monitor devices: a comprehensive observational study of consecutive intensive care unit patients. PLOS ONE, 9(10), e110274.",
    ],
  },
  {
    section: "Nursing communication & workload",
    entries: [
      "Westbrook, J. I., Duffield, C., Li, L., & Creswick, N. J. (2011). How much time do nurses have for patients? A longitudinal study quantifying hospital nurses' patterns of task time distribution and interactions with health professionals. BMC Health Services Research, 11, 319.",
      "Aiken, L. H., Sloane, D. M., Bruyneel, L., Van den Heede, K., Griffiths, P., Busse, R., ... & Sermeus, W. (2014). Nurse staffing and education and hospital mortality in nine European countries. The Lancet, 383(9931), 1824–1830.",
    ],
  },
  {
    section: "Eye-gaze interfaces & accessibility",
    entries: [
      "Majaranta, P., & Bulling, A. (2014). Eye tracking and eye-based human–computer interaction. In Advances in Physiological Computing (pp. 39–65). Springer.",
      "Donegan, M., Morris, J. D., Corno, F., Signorile, I., Chió, A., Pasian, V., ... & Holmqvist, E. (2009). Understanding users and their needs. Universal Access in the Information Society, 8(4), 259–275.",
    ],
  },
  {
    section: "Statistical methods",
    entries: [
      "Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. Journal of the American Statistical Association, 22(158), 209–212.",
      "Newcombe, R. G. (1998). Two-sided confidence intervals for the single proportion: comparison of seven methods. Statistics in Medicine, 17(8), 857–872.",
      "Sweeney, L. (2002). k-Anonymity: A model for protecting privacy. International Journal of Uncertainty, Fuzziness and Knowledge-Based Systems, 10(5), 557–570.",
    ],
  },
] as const;

export default function ReferencesPage() {
  return (
    <InsightsShell>
      {() => (
        <article className="prose prose-slate max-w-3xl">
          <h1>References</h1>
          <p>
            ring is not a clean-room invention; it stands on a long tradition
            of nursing-workflow research, accessibility engineering, and
            biostatistics. This page collects the works our methodology and
            framing draw on. Citations are in APA format.
          </p>

          {REFERENCES.map((group) => (
            <section key={group.section}>
              <h2>{group.section}</h2>
              <ol>
                {group.entries.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ol>
            </section>
          ))}
        </article>
      )}
    </InsightsShell>
  );
}
