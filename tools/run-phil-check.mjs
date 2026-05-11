import { spawn } from "node:child_process";

function run(name, command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${name} failed (exit ${code ?? -1})`));
    });
  });
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function checkPublicApi(origin) {
  const url = `${origin}/api/v1/insights/aggregates?limit=7`;
  const { res, body } = await fetchJson(url);
  if (!res.ok) {
    const msg = body && typeof body === "object" ? JSON.stringify(body) : `HTTP ${res.status}`;
    throw new Error(`Public API check failed: ${msg}`);
  }
  if (!body || typeof body !== "object" || !("data" in body) || !("metadata" in body)) {
    throw new Error("Public API response does not include { data, metadata }");
  }
  const cc = res.headers.get("cache-control") ?? "";
  if (!cc.includes("public, max-age=300")) {
    throw new Error(`Unexpected Cache-Control: ${cc || "(missing)"}`);
  }
  const limit = res.headers.get("x-ratelimit-limit");
  if (!limit) {
    throw new Error("Missing X-RateLimit-Limit header");
  }
}

async function checkCronDryRun(origin, secret) {
  const url = `${origin}/api/cron/aggregate-phil?date=2026-05-10&dryRun=1`;
  const { res, body } = await fetchJson(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) {
    const msg = body && typeof body === "object" ? JSON.stringify(body) : `HTTP ${res.status}`;
    throw new Error(`Cron dryRun check failed: ${msg}`);
  }
  if (!body || typeof body !== "object") {
    throw new Error("Cron response body missing");
  }
}

async function main() {
  await run("test:run", "npm run test:run");
  await run("tsc", "npx tsc --noEmit");
  await run("lint", "npm run lint");
  await run("build", "npm run build");

  const origin = process.env["ORIGIN"] ?? process.env["PHIL_ORIGIN"] ?? "http://localhost:3000";
  await checkPublicApi(origin);

  const secret = mustEnv("CRON_SECRET");
  await checkCronDryRun(origin, secret);

  console.log("✅ PHIL checks passed.");
}

void main().catch((err) => {
  console.error(`❌ PHIL checks failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
