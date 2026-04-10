import { readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const TARGET_DIRS = ["app", "components", "hooks", "lib", "types"];
const TARGET_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".mjs", ".md"]);
const POLL_MS = 3000;

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function snapshot() {
  const files = TARGET_DIRS.flatMap((d) => walk(resolve(ROOT, d)));
  const map = new Map();
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (!TARGET_EXT.has(ext)) continue;
    try {
      const st = statSync(f);
      map.set(f, st.mtimeMs);
    } catch {
      // ignore vanished files
    }
  }
  return map;
}

function hasChanged(prev, next) {
  if (prev.size !== next.size) return true;
  for (const [k, v] of next) {
    if (prev.get(k) !== v) return true;
  }
  return false;
}

function runQuality() {
  return new Promise((resolveRun) => {
    console.log("\n=== auto-run: npm run run:quality ===");
    const child = spawn("npm run run:quality", {
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => {
      console.log(`=== auto-run: exit ${code ?? -1} ===`);
      resolveRun(code ?? 1);
    });
  });
}

async function main() {
  console.log("auto-run started: watching app/components/hooks/lib/types");
  let prev = snapshot();
  let running = false;
  let pending = false;

  const trigger = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    await runQuality();
    running = false;
    if (pending) {
      pending = false;
      await trigger();
    }
  };

  await trigger(); // initial run

  setInterval(async () => {
    const next = snapshot();
    if (!hasChanged(prev, next)) return;
    prev = next;
    console.log(`[auto-run] change detected at ${new Date().toLocaleTimeString()}`);
    await trigger();
  }, POLL_MS);
}

void main();
