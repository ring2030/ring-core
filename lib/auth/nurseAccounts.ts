import { createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_HOSPITAL_ID } from "@/lib/auth/hospitalScope";

type StoredNurseAccount = {
  id: string;
  hospitalId: string;
  passwordHash: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type NurseAccountStore = {
  accounts: StoredNurseAccount[];
};

export type NurseAccountView = {
  id: string;
  hospitalId: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
};

// Prefer /tmp (writable on Vercel/Lambda); fall back to local .data for dev
const STORE_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? "/tmp/.ring-data"
  : path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "nurse-accounts.json");
const DEFAULT_ID = "1";
const DEFAULT_PASSWORD = "1";

function getSecret(): string {
  return process.env.APP_SIGNING_SECRET?.trim() || "ring-core-dev-only-secret-change-me";
}

function hashPassword(password: string): string {
  return createHmac("sha256", getSecret()).update(password).digest("hex");
}

async function writeStore(data: NurseAccountStore): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function readStore(): Promise<NurseAccountStore> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as NurseAccountStore;
    if (!Array.isArray(parsed.accounts)) throw new Error("invalid store");
    for (const account of parsed.accounts) {
      if (!account.hospitalId) account.hospitalId = DEFAULT_HOSPITAL_ID;
    }
    return parsed;
  } catch {
    const now = new Date().toISOString();
    const initial: NurseAccountStore = {
      accounts: [
        {
          id: DEFAULT_ID,
          hospitalId: DEFAULT_HOSPITAL_ID,
          passwordHash: hashPassword(DEFAULT_PASSWORD),
          disabled: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    // Best-effort persist; ignore write failures (e.g. read-only FS on Vercel)
    try {
      await writeStore(initial);
    } catch {
      /* ignore */
    }
    return initial;
  }
}

function toView(account: StoredNurseAccount): NurseAccountView {
  return {
    id: account.id,
    hospitalId: account.hospitalId,
    disabled: account.disabled,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function listNurseAccounts(hospitalId: string): Promise<NurseAccountView[]> {
  const store = await readStore();
  return store.accounts
    .filter((a) => a.hospitalId === hospitalId)
    .map(toView)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function verifyNurseCredentials(id: string, password: string): Promise<boolean> {
  const store = await readStore();
  const account = store.accounts.find((a) => a.id === id);
  if (!account || account.disabled) return false;
  return account.passwordHash === hashPassword(password);
}

export async function listHospitalsForNurse(id: string, password: string): Promise<string[]> {
  const store = await readStore();
  const passwordHash = hashPassword(password);
  const matched = store.accounts.filter(
    (a) => a.id === id && !a.disabled && a.passwordHash === passwordHash,
  );
  return [...new Set(matched.map((a) => a.hospitalId))].sort();
}

export async function createNurseAccount(
  id: string,
  password: string,
  hospitalId: string,
): Promise<NurseAccountView> {
  const normId = id.trim();
  if (!normId) throw new Error("ID is required.");
  if (password.length < 1) throw new Error("Password is required.");
  const store = await readStore();
  if (store.accounts.some((a) => a.id === normId && a.hospitalId === hospitalId)) {
    throw new Error("That ID already exists.");
  }
  const now = new Date().toISOString();
  const created: StoredNurseAccount = {
    id: normId,
    hospitalId,
    passwordHash: hashPassword(password),
    disabled: false,
    createdAt: now,
    updatedAt: now,
  };
  store.accounts.push(created);
  await writeStore(store);
  return toView(created);
}

export async function updateNurseAccount(args: {
  id: string;
  hospitalId: string;
  disabled?: boolean;
  password?: string;
}): Promise<NurseAccountView> {
  const store = await readStore();
  const account = store.accounts.find(
    (a) => a.id === args.id && a.hospitalId === args.hospitalId,
  );
  if (!account) throw new Error("No account found for that ID.");
  if (typeof args.disabled === "boolean") account.disabled = args.disabled;
  if (typeof args.password === "string" && args.password.length > 0) {
    account.passwordHash = hashPassword(args.password);
  }
  account.updatedAt = new Date().toISOString();
  await writeStore(store);
  return toView(account);
}

export async function addHospitalMembership(args: {
  id: string;
  fromHospitalId: string;
  toHospitalId: string;
}): Promise<NurseAccountView> {
  const sourceHospitalId = args.fromHospitalId.trim();
  const targetHospitalId = args.toHospitalId.trim();
  if (!sourceHospitalId || !targetHospitalId) {
    throw new Error("Source and target hospital IDs are required.");
  }
  const store = await readStore();
  const source = store.accounts.find(
    (a) => a.id === args.id && a.hospitalId === sourceHospitalId,
  );
  if (!source) throw new Error("No account found in the current hospital.");
  const exists = store.accounts.find(
    (a) => a.id === args.id && a.hospitalId === targetHospitalId,
  );
  if (exists) throw new Error("That account is already assigned to the target hospital.");
  const now = new Date().toISOString();
  const created: StoredNurseAccount = {
    id: source.id,
    hospitalId: targetHospitalId,
    passwordHash: source.passwordHash,
    disabled: source.disabled,
    createdAt: now,
    updatedAt: now,
  };
  store.accounts.push(created);
  await writeStore(store);
  return toView(created);
}
