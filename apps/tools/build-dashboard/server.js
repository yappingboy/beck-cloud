// Build dashboard - Node 22, zero dependencies.
// Source: tools/build-dashboard/ in the beck-cloud repo.
// Rebuilt via build-build-dashboard job in toolbox ns.
const http = require("http");
const fs = require("fs");
const { execFile } = require("child_process");

const JOBS = [
  { id: "build-hash", ns: "micro", name: "Hash", image: "ghcr.io/yappingboy/hash:latest" },
  { id: "build-base64", ns: "micro", name: "Base64 Converter", image: "ghcr.io/yappingboy/converter:latest" },
  { id: "build-shortener", ns: "micro", name: "URL Shortener", image: "ghcr.io/yappingboy/url-shortener:latest" },
  { id: "build-qr", ns: "micro", name: "QR Generator", image: "ghcr.io/yappingboy/qr-generator:latest" },
  { id: "build-yaml-json", ns: "micro", name: "YAML/JSON Tool", image: "ghcr.io/yappingboy/yaml-json-tool:latest" },
  { id: "build-webhook", ns: "micro", name: "Webhook Relay", image: "ghcr.io/yappingboy/webhook-relay:latest" },
  { id: "build-cron", ns: "micro", name: "Cron Jobs", image: "ghcr.io/yappingboy/cron-jobs:latest" },
  { id: "build-dns", ns: "micro", name: "DNS Monitor", image: "ghcr.io/yappingboy/dns-monitor:latest" },
  { id: "build-auth-micro", ns: "micro", name: "Auth Micro", image: "ghcr.io/yappingboy/auth-micro:latest" },
  { id: "build-image-editor-api", ns: "micro", name: "Image Editor API", image: "ghcr.io/yappingboy/image-editor-api:latest" },
  { id: "build-image-editor-frontend", ns: "micro", name: "Image Editor Frontend", image: "ghcr.io/yappingboy/image-editor-frontend:latest" },
  { id: "build-beckflow-api", ns: "micro", name: "BeckFlow API", image: "ghcr.io/yappingboy/beckflow:latest" },
  { id: "build-beckflow-frontend", ns: "micro", name: "BeckFlow Frontend", image: "ghcr.io/yappingboy/beckflow-frontend:latest" },
  { id: "build-gridspace", ns: "toolbox", name: "GridSpace", image: "ghcr.io/yappingboy/becklab-gridspace:latest" },
  { id: "build-cadam", ns: "toolbox", name: "CADAM", image: "ghcr.io/yappingboy/cadam:latest" },
  { id: "build-emdr", ns: "toolbox", name: "EMDR", image: "ghcr.io/yappingboy/emdr:latest" },
  { id: "build-user-invite", ns: "toolbox", name: "User Invite", image: "ghcr.io/yappingboy/becklab-user-invite:latest" },
];

function kubectl(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile("kubectl", args, { timeout: timeoutMs || 20000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout.trim());
    });
  });
}

function kubectlInput(args, input, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = execFile("kubectl", args, { timeout: timeoutMs || 30000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout.trim());
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

function stripJobYaml(yaml, job) {
  let out = yaml;
  // remove top-level status block (status: ... followed by non-indented key)
  out = out.replace(/^status:.*(\n(?! [a-z]).*)*$/m, "");
  // drop server-side fields
  out = out
    .replace(/^\s*creationTimestamp: [^\n]*$/gm, "")
    .replace(/^\s*resourceVersion: [^\n]*$/gm, "")
    .replace(/^\s*uid: [^\n]*$/gm, "")
    .replace(/^\s*selfLink: [^\n]*$/gm, "")
    .replace(/^\s*managedFields:.*(\n\s+-.*.*)*$/gm, "");
  return out;
}

async function jobState(job) {
  try {
    const out = await kubectl([
      "get", "job", job.id, "-n", job.ns,
      "-o", "jsonpath={.status.succeeded}|{.status.failed}|{.status.active}|{.status.startTime}|{.metadata.creationTimestamp}",
    ]);
    const [succeeded, failed, active, startTime, created] = out.split("|");
    const state =
      Number(failed || 0) > 0 ? "failed" :
      Number(succeeded || 0) > 0 ? "success" :
      Number(active || 0) > 0 ? "running" : "idle";
    return { state, age: created, startTime, succeeded, failed, active };
  } catch {
    return { state: "error", age: null, startTime: null, succeeded: null, failed: null, active: null };
  }
}

async function getLogs(job) {
  let pod = null;
  try {
    pod = await kubectl([
      "get", "pods", "-n", job.ns, "-l", "job-name=" + job.id,
      "-o", "jsonpath={.items[0].metadata.name}",
    ]);
  } catch { pod = null; }
  if (!pod) return { pod: null, logs: "", init: "" };
  let logs = "", init = "";
  try {
    const names = await kubectl(["get", "pod", pod, "-n", job.ns,
      "-o", "jsonpath={.spec.containers[*].name}|{range .spec.initContainers[*].name}{.name}|{end}"]);
    const [main, initsRaw] = names.split("|");
    for (const c of initsRaw.split(/\|/).filter(Boolean)) {
      const chunk = await kubectl(["logs", "-n", job.ns, pod, "-c", c, "--tail=100"], 15000).catch(() => "");
      if (chunk) init += "[init " + c + "]\n" + chunk + "\n";
    }
    logs = await kubectl(["logs", "-n", job.ns, pod, "-c", main || "kaniko", "--tail=400"], 15000).catch(() => "");
  } catch { /* partial logs are fine */ }
  return { pod, logs, init };
}

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync("/app/index.html", "utf8"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/status") {
      const jobs = await Promise.all(JOBS.map(async (j) => ({ ...j, ...(await jobState(j)) })));
      return json(res, 200, { jobs });
    }

    if (req.method === "GET" && parts[0] === "api" && parts[1] === "logs" && parts[2]) {
      const job = JOBS.find((j) => j.id === parts[2]);
      if (!job) return json(res, 404, { error: "unknown job" });
      return json(res, 200, await getLogs(job));
    }

    if (req.method === "POST" && parts[0] === "api" && parts[1] === "build" && parts[2]) {
      const all = parts[2] === "all";
      const targets = all ? JOBS : JOBS.filter((j) => j.id === parts[2]);
      if (targets.length === 0) return json(res, 404, { error: "unknown job" });
      const results = [];
      for (const job of targets) {
        try {
          const yaml = await kubectl(["get", "job", job.id, "-n", job.ns, "-o", "yaml"]);
          const cleaned = stripJobYaml(yaml, job.id);
          await kubectl(["delete", "job", job.id, "-n", job.ns, "--ignore-not-found=true"]);
          await kubectlInput(["apply", "-n", job.ns, "--force=true", "-f", "-"], cleaned, 30000);
          results.push({ id: job.id, ok: true });
        } catch (e) {
          results.push({ id: job.id, ok: false, error: e.message });
        }
      }
      return json(res, 200, { results });
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(8080, "0.0.0.0", () => console.log("build dashboard listening on 8080"));
