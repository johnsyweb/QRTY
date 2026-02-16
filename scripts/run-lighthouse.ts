import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_PORT = "4173";
const basePath = (process.env.BASE_URL ?? "/QRTY/").replace(/\/$/, "") || "";
const pathSegment = basePath ? `${basePath}/` : "/";
const DEFAULT_URL = `http://localhost:${DEFAULT_PORT}${pathSegment}`;

const reportPath = path.resolve(process.cwd(), "lighthouse-report.json");
const lighthouseUrl = process.env.LIGHTHOUSE_URL ?? DEFAULT_URL;
const lighthousePort = process.env.LIGHTHOUSE_PORT ?? DEFAULT_PORT;
const waitTimeoutMs = Number(process.env.LIGHTHOUSE_TIMEOUT_MS ?? "60000");
const uploadTarget =
  process.env.LIGHTHOUSE_UPLOAD_TARGET ??
  (process.env.CI ? "temporary-public-storage" : "");

const previewArgs = [
  path.resolve(process.cwd(), "node_modules/vite/bin/vite.js"),
  "preview",
  "--port",
  lighthousePort,
  "--strictPort",
  "--host",
  "localhost",
];

const categories = ["performance", "accessibility", "best-practices", "seo"];

const runCommand = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });

const waitForServer = async (url: string, timeoutMs: number) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore until the preview server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for preview server at ${url}`);
};

const loadReport = async () => {
  const reportRaw = await readFile(reportPath, "utf8");
  return JSON.parse(reportRaw) as {
    categories: Record<
      string,
      { score?: number; auditRefs?: { id: string }[] }
    >;
    audits: Record<
      string,
      {
        score?: number | null;
        title?: string;
        details?: { items?: Array<Record<string, unknown>> };
      }
    >;
  };
};

const getScores = (report: Awaited<ReturnType<typeof loadReport>>) => {
  const getScore = (key: string) => report.categories?.[key]?.score ?? 0;

  return {
    performance: getScore("performance"),
    accessibility: getScore("accessibility"),
    bestPractices: getScore("best-practices"),
    seo: getScore("seo"),
  };
};

const logScores = (scores: ReturnType<typeof getScores>) => {
  const asPercent = (value: number) => Math.round(value * 100);
  console.log("Lighthouse scores:");
  console.log(`- performance: ${asPercent(scores.performance)}`);
  console.log(`- accessibility: ${asPercent(scores.accessibility)}`);
  console.log(`- best-practices: ${asPercent(scores.bestPractices)}`);
  console.log(`- seo: ${asPercent(scores.seo)}`);
};

const logFailingAudits = (
  report: Awaited<ReturnType<typeof loadReport>>,
  categoryId: "best-practices" | "accessibility" | "seo"
) => {
  const category = report.categories?.[categoryId];
  if (!category?.auditRefs) return;

  const failingAudits = category.auditRefs
    .map((ref) => ({ id: ref.id, audit: report.audits?.[ref.id] }))
    .filter((entry) => entry.audit && entry.audit.score !== null)
    .filter((entry) => (entry.audit?.score ?? 1) < 1);

  if (failingAudits.length === 0) return;

  console.log(`\nFailing ${categoryId} audits:`);
  for (const { id, audit } of failingAudits) {
    console.log(`- ${id}: ${audit?.title ?? "Untitled"}`);
    const items = audit?.details?.items ?? [];
    for (const item of items) {
      const description = item.description as string | undefined;
      const sourceLocation = item.sourceLocation as
        | { url?: string; line?: number; column?: number }
        | undefined;
      const node = item.node as
        | { selector?: string; snippet?: string }
        | undefined;
      const url = (item.url as string | undefined) ?? "";
      const source = node?.selector || node?.snippet || url;
      if (description) {
        console.log(`  - ${description}`);
      }
      if (sourceLocation?.url) {
        const line = sourceLocation.line ?? 0;
        const column = sourceLocation.column ?? 0;
        console.log(`  - source: ${sourceLocation.url}:${line}:${column}`);
      }
      if (!description && source) {
        console.log(`  - ${source}`);
      }
    }
  }
};

const main = async () => {
  const previewProcess = spawn(process.execPath, previewArgs, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  try {
    await waitForServer(lighthouseUrl, waitTimeoutMs);

    await runCommand("lighthouse", [
      lighthouseUrl,
      "--preset=desktop",
      "--output=json",
      `--output-path=${reportPath}`,
      `--only-categories=${categories.join(",")}`,
      ...(uploadTarget ? [`--upload-target=${uploadTarget}`] : []),
      "--quiet",
      "--chrome-flags=--headless=new --no-sandbox",
    ]);

    const report = await loadReport();
    const scores = getScores(report);
    logScores(scores);

    const failedCategories = [
      scores.accessibility < 1 ? "accessibility" : null,
      scores.bestPractices < 1 ? "best-practices" : null,
      scores.seo < 1 ? "seo" : null,
    ].filter(Boolean) as string[];

    if (failedCategories.length > 0) {
      for (const category of failedCategories) {
        if (
          category === "best-practices" ||
          category === "accessibility" ||
          category === "seo"
        ) {
          logFailingAudits(
            report,
            category as "best-practices" | "accessibility" | "seo"
          );
        }
      }
      throw new Error(
        `Lighthouse scores below 100: ${failedCategories.join(", ")}`
      );
    }
  } finally {
    if (!previewProcess.killed) {
      previewProcess.kill("SIGTERM");
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
