import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const processes = [
  spawn("node", ["--watch", "server.mjs"], { stdio: "inherit" }),
  spawn(command, ["exec", "vite"], { stdio: "inherit" })
];

function stop() {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stop();
      process.exitCode = code;
    }
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
