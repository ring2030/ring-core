"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

interface Cta {
  label: string;
  href: string;
  hint: string;
  /** Opens in a new tab (YouTube, etc.). */
  external?: boolean;
}

const CTAS: Cta[] = [
  { label: "Try it yourself", href: "/", hint: "Open the patient view" },
  { label: "30-second feedback", href: "/demo-1min", hint: "Help the team improve" },
  {
    label: "Watch our pitch video",
    href: "https://youtu.be/aQnctUeBXYQ",
    hint: "Behind the build",
    external: true,
  },
];

export function Chapter4Outro() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-live="polite"
      className="relative flex h-full w-full flex-col items-center justify-center bg-black px-6 text-center text-white"
    >
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.7 }}
        className="text-3xl font-light tracking-tight text-white sm:text-5xl"
      >
        Thank you for these <span className="font-semibold text-rose-300">60 seconds</span>.
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {CTAS.map((c) => {
          const cardClass =
            "group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/15 transition hover:-translate-y-1 hover:from-rose-500/15 hover:to-cyan-500/10 hover:ring-rose-300/40";
          const body = (
            <>
              <div className="text-base font-semibold text-white">{c.label}</div>
              <div className="mt-1 text-xs text-white/60">{c.hint}</div>
              <div className="mt-3 text-xs font-mono text-rose-200/80 transition group-hover:text-rose-200">
                {c.href} →
              </div>
            </>
          );
          return c.external ? (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cardClass}
            >
              {body}
            </a>
          ) : (
            <Link key={c.label} href={c.href} className={cardClass}>
              {body}
            </Link>
          );
        })}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="mt-8 text-xs text-white/55"
      >
        Or press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/80">R</kbd> to restart the tour
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.6 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.25em] text-white/35"
      >
        ring · designed in Japan by 11–16-year-old girls
      </motion.p>
    </div>
  );
}

export default Chapter4Outro;
