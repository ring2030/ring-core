"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";

interface Props {
  onStart: () => void;
}

/**
 * Pre-tour gate: pulses the ring brand mark and prompts the judge to begin.
 * No timer runs until {@link onStart} is invoked by SPACE / click in TourFrame.
 */
export function Chapter0Intro({ onStart }: Props) {
  const reducedMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onStart}
      aria-label="Start the 60-second guided tour"
      className="relative h-full w-full cursor-pointer bg-black text-left text-white outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial={{ scale: 1, opacity: 0.18 }}
        animate={
          reducedMotion
            ? { scale: 1, opacity: 0.2 }
            : { scale: [1, 1.05, 1], opacity: [0.15, 0.25, 0.15] }
        }
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <div className="flex flex-col items-center gap-3">
          <Heart
            className="h-40 w-40 text-rose-400 sm:h-56 sm:w-56"
            strokeWidth={1.4}
            fill="currentColor"
            fillOpacity={0.35}
          />
          <div className="text-3xl font-extralight tracking-[0.45em] text-rose-100 sm:text-5xl">
            ring
          </div>
        </div>
      </motion.div>

      <div
        aria-live="polite"
        className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center"
      >
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="text-4xl font-light text-white sm:text-6xl md:text-7xl"
        >
          60-second guided tour
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-6 text-sm text-rose-200/80 sm:text-base"
        >
          Press <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono">SPACE</kbd> or click to start
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.8 }}
          className="mt-12 max-w-xl text-balance text-base leading-relaxed text-white/70 sm:text-lg"
        >
          You&rsquo;ll see the same data from <span className="text-rose-300">3 perspectives</span> in 60 seconds.
          The same call. The same family. From the nurse, the family, and the patient.
        </motion.p>
      </div>
    </button>
  );
}

export default Chapter0Intro;
