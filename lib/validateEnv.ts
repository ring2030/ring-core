/**
 * Environment variable validation.
 *
 * Call validateServerEnv() once at server startup (next.config.ts) to surface
 * missing config immediately instead of discovering it mid-request.
 *
 * Individual API routes can call requireServerEnv() for typed access.
 */

/**
 * Returns the env var or throws with a clear message.
 * Use in server-only code (API routes, Server Components).
 */
export function requireServerEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `Missing required environment variable "${key}". Copy .env.example to .env.local and fill in the value.`,
    );
  }
  return val;
}

const REQUIRED_SERVER_ENV = ["GEMINI_API_KEY"] as const;

const REQUIRED_CLIENT_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_EYEDID_LICENSE_KEY",
] as const;

/**
 * Validates all required env vars.
 * Returns a list of missing variable names (empty = all present).
 * Logs each missing var to console.
 */
export function validateEnv(): string[] {
  const missing: string[] = [];

  for (const key of [...REQUIRED_SERVER_ENV, ...REQUIRED_CLIENT_ENV]) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[ring-core] Missing environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}\n` +
      `Copy .env.example to .env.local and fill in the missing values.`,
    );
  }

  return missing;
}
