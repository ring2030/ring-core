import * as Sentry from "@sentry/nextjs";
import { makePiiBeforeSend, parseSampleRate, resolveRelease } from "@/lib/sentry/config";

Sentry.init({
  dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  environment: process.env["NEXT_PUBLIC_SENTRY_ENVIRONMENT"] ?? process.env["NODE_ENV"],
  enabled: Boolean(process.env["NEXT_PUBLIC_SENTRY_DSN"]),
  release: resolveRelease(
    process.env["NEXT_PUBLIC_SENTRY_RELEASE"],
    process.env["NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA"],
  ),
  tracesSampleRate: parseSampleRate(
    process.env["NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE"],
    0.02,
  ),
  replaysSessionSampleRate: parseSampleRate(
    process.env["NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE"],
    0,
  ),
  replaysOnErrorSampleRate: parseSampleRate(
    process.env["NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE"],
    0.5,
  ),
  integrations: [Sentry.replayIntegration()],
  sendDefaultPii: false,
  beforeSend: makePiiBeforeSend(),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
