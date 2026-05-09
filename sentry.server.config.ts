import * as Sentry from "@sentry/nextjs";
import { makePiiBeforeSend, parseSampleRate, resolveRelease } from "@/lib/sentry/config";

Sentry.init({
  dsn: process.env["SENTRY_DSN"],
  environment: process.env["SENTRY_ENVIRONMENT"] ?? process.env["NODE_ENV"],
  enabled: Boolean(process.env["SENTRY_DSN"]),
  release: resolveRelease(
    process.env["SENTRY_RELEASE"],
    process.env["VERCEL_GIT_COMMIT_SHA"],
  ),
  tracesSampleRate: parseSampleRate(process.env["SENTRY_TRACES_SAMPLE_RATE"], 0.05),
  sendDefaultPii: false,
  beforeSend: makePiiBeforeSend(),
});
