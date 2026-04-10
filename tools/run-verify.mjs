import { mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const outDir = resolve(process.cwd(), ".artifacts", "verify");
mkdirSync(outDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logPath = resolve(outDir, `run-verify-${timestamp}.log`);
const log = createWriteStream(logPath, { flags: "a" });

function write(line) {
  process.stdout.write(line);
  log.write(line);
}

function runStep(name, command) {
  return new Promise((resolveStep, rejectStep) => {
    write(`\n=== [${name}] ${command}\n`);
    const child = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    child.stdout.on("data", (d) => write(d.toString()));
    child.stderr.on("data", (d) => write(d.toString()));
    child.on("close", (code) => {
      write(`\n--- [${name}] exit_code=${code ?? -1}\n`);
      if (code === 0) resolveStep();
      else rejectStep(new Error(`${name} failed`));
    });
  });
}

async function main() {
  const started = Date.now();
  try {
    await runStep("lint", "npm run lint");
    await runStep("quality", "npm run run:quality");
    await runStep("build", "npm run build");
    const elapsed = Date.now() - started;
    write(`\n✅ run:verify passed in ${elapsed}ms\nlog: ${logPath}\n`);
    log.end();
  } catch {
    const elapsed = Date.now() - started;
    write(`\n❌ run:verify failed in ${elapsed}ms\nlog: ${logPath}\n`);
    log.end();
    process.exitCode = 1;
  }
}

void main();
