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

async function main() {
  await run("lint:gaze", "npm run lint:gaze");
  await run("test:run", "npm run test:run");
}

void main().catch(() => {
  process.exitCode = 1;
});
