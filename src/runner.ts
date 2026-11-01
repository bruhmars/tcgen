import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface Failure {
  fnName: string;  // which function's tests
  title: string;   // the test's name
  message: string; // why it failed
}

export interface RunResult {
  crashed: boolean;      // true if the test file couldn't even run
  crashMessage: string;
  total: number;
  passed: number;
  failed: number;
  failures: Failure[];
  coverage: { lines: number; branches: number; functions: number } | null;
}

function crash(message: string): RunResult {
  return { crashed: true, crashMessage: message, total: 0, passed: 0, failed: 0, failures: [], coverage: null };
}

export function runTests(testFile: string, sourceFile: string, timeoutMs = 60_000): RunResult {
  const tmpDir = path.join(".tcgen", "run");
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  const jsonPath = path.join(tmpDir, "results.json");
  const coverageDir = path.join(tmpDir, "coverage");

  // Run vitest like you would by hand, but ask for results as a JSON file
  const proc = spawnSync(
    "npx",
    [
      "vitest", "run", testFile,
      "--reporter=json",
      `--outputFile=${jsonPath}`,
      "--coverage.enabled=true",
      "--coverage.provider=v8",
      "--coverage.reporter=json-summary",
      `--coverage.reportsDirectory=${coverageDir}`,
      `--coverage.include=${sourceFile}`,
    ],
    { encoding: "utf-8", timeout: timeoutMs } // stop after 60 seconds
  );

  if ((proc.error as any)?.code === "ETIMEDOUT") {
    return crash(`TIMEOUT: the tests were stopped after ${timeoutMs / 1000} seconds (infinite loop?).`);
  }
  if (!fs.existsSync(jsonPath)) {
    return crash(`Vitest gave no results. ${(proc.stderr || proc.stdout || "").slice(0, 600)}`);
  }

  // Read the results
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const failures: Failure[] = [];
  let crashMessage = "";

  for (const file of data.testResults ?? []) {
    const tests = file.assertionResults ?? [];
    if (tests.length === 0 && file.status === "failed") {
      crashMessage = file.message || "The test file failed to run.";
    }
    for (const t of tests) {
      if (t.status === "failed") {
        failures.push({
          fnName: t.ancestorTitles?.[0] ?? "",
          title: t.title,
          message: (t.failureMessages ?? []).join("\n").split("\n").slice(0, 2).join(" ").slice(0, 300),
        });
      }
    }
  }

  // PHASE 8: read the coverage numbers
  let coverage: RunResult["coverage"] = null;
  const coveragePath = path.join(coverageDir, "coverage-summary.json");
  if (fs.existsSync(coveragePath)) {
    const total = JSON.parse(fs.readFileSync(coveragePath, "utf-8")).total;
    coverage = {
      lines: Number(total.lines.pct),
      branches: Number(total.branches.pct),
      functions: Number(total.functions.pct),
    };
  }

  return {
    crashed: crashMessage !== "",
    crashMessage,
    total: data.numTotalTests ?? 0,
    passed: data.numPassedTests ?? 0,
    failed: data.numFailedTests ?? 0,
    failures,
    coverage,
  };
}