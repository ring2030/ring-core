import { promises as fs } from "node:fs";
import path from "node:path";

type LoginState = {
  failedCount: number;
  lockUntilMs: number;
};

type LoginStateStore = {
  users: Record<string, LoginState>;
};

const STORE_DIR = process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"]
  ? "/tmp/.ring-data"
  : path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "nurse-login-state.json");
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

async function readStore(): Promise<LoginStateStore> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as LoginStateStore;
    if (!parsed.users || typeof parsed.users !== "object") {
      return { users: {} };
    }
    return parsed;
  } catch {
    return { users: {} };
  }
}

async function writeStore(store: LoginStateStore): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function getLoginLockRemainingSec(loginId: string): Promise<number> {
  const store = await readStore();
  const row = store.users[loginId];
  if (!row) return 0;
  const remaining = row.lockUntilMs - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export async function recordLoginFailure(loginId: string): Promise<{ locked: boolean; remainingSec: number }> {
  const store = await readStore();
  const now = Date.now();
  const current = store.users[loginId] ?? { failedCount: 0, lockUntilMs: 0 };
  if (current.lockUntilMs > now) {
    return { locked: true, remainingSec: Math.ceil((current.lockUntilMs - now) / 1000) };
  }
  const nextCount = current.failedCount + 1;
  if (nextCount >= MAX_FAILURES) {
    const lockUntilMs = now + LOCK_MS;
    store.users[loginId] = { failedCount: 0, lockUntilMs };
    await writeStore(store);
    return { locked: true, remainingSec: Math.ceil(LOCK_MS / 1000) };
  }
  store.users[loginId] = { failedCount: nextCount, lockUntilMs: 0 };
  await writeStore(store);
  return { locked: false, remainingSec: 0 };
}

export async function clearLoginFailures(loginId: string): Promise<void> {
  const store = await readStore();
  if (store.users[loginId]) {
    store.users[loginId] = { failedCount: 0, lockUntilMs: 0 };
    await writeStore(store);
  }
}

