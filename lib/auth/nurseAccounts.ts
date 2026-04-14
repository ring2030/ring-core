import { createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

type StoredNurseAccount = {
  id: string;
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
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const STORE_DIR = path.join(process.cwd(), ".data");
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
    return parsed;
  } catch {
    const now = new Date().toISOString();
    const initial: NurseAccountStore = {
      accounts: [
        {
          id: DEFAULT_ID,
          passwordHash: hashPassword(DEFAULT_PASSWORD),
          disabled: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    await writeStore(initial);
    return initial;
  }
}

function toView(account: StoredNurseAccount): NurseAccountView {
  return {
    id: account.id,
    disabled: account.disabled,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function listNurseAccounts(): Promise<NurseAccountView[]> {
  const store = await readStore();
  return store.accounts.map(toView).sort((a, b) => a.id.localeCompare(b.id));
}

export async function verifyNurseCredentials(id: string, password: string): Promise<boolean> {
  const store = await readStore();
  const account = store.accounts.find((a) => a.id === id);
  if (!account || account.disabled) return false;
  return account.passwordHash === hashPassword(password);
}

export async function createNurseAccount(id: string, password: string): Promise<NurseAccountView> {
  const normId = id.trim();
  if (!normId) throw new Error("IDは必須です。");
  if (password.length < 1) throw new Error("パスワードは必須です。");
  const store = await readStore();
  if (store.accounts.some((a) => a.id === normId)) {
    throw new Error("そのIDは既に存在します。");
  }
  const now = new Date().toISOString();
  const created: StoredNurseAccount = {
    id: normId,
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
  disabled?: boolean;
  password?: string;
}): Promise<NurseAccountView> {
  const store = await readStore();
  const account = store.accounts.find((a) => a.id === args.id);
  if (!account) throw new Error("指定IDが見つかりません。");
  if (typeof args.disabled === "boolean") account.disabled = args.disabled;
  if (typeof args.password === "string" && args.password.length > 0) {
    account.passwordHash = hashPassword(args.password);
  }
  account.updatedAt = new Date().toISOString();
  await writeStore(store);
  return toView(account);
}
