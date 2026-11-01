"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function crash(message) {
    return { crashed: true, crashMessage: message, total: 0, passed: 0, failed: 0, failures: [], coverage: null };
}
function runTests(testFile, sourceFile, timeoutMs = 60_000) {
    const tmpDir = node_path_1.default.join(".tcgen", "run");
    node_fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    node_fs_1.default.mkdirSync(tmpDir, { recursive: true });
    const jsonPath = node_path_1.default.join(tmpDir, "results.json");
    const coverageDir = node_path_1.default.join(tmpDir, "coverage");
    // Run vitest like you would by hand, but ask for results as a JSON file
    const proc = (0, node_child_process_1.spawnSync)("npx", [
        "vitest", "run", testFile,
        "--reporter=json",
        `--outputFile=${jsonPath}`,
        "--coverage.enabled=true",
        "--coverage.provider=v8",
        "--coverage.reporter=json-summary",
        `--coverage.reportsDirectory=${coverageDir}`,
        `--coverage.include=${sourceFile}`,
    ], { encoding: "utf-8", timeout: timeoutMs } // stop after 60 seconds
    );
    if (proc.error?.code === "ETIMEDOUT") {
        return crash(`TIMEOUT: the tests were stopped after ${timeoutMs / 1000} seconds (infinite loop?).`);
    }
    if (!node_fs_1.default.existsSync(jsonPath)) {
        return crash(`Vitest gave no results. ${(proc.stderr || proc.stdout || "").slice(0, 600)}`);
    }
    // Read the results
    const data = JSON.parse(node_fs_1.default.readFileSync(jsonPath, "utf-8"));
    const failures = [];
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
    let coverage = null;
    const coveragePath = node_path_1.default.join(coverageDir, "coverage-summary.json");
    if (node_fs_1.default.existsSync(coveragePath)) {
        const total = JSON.parse(node_fs_1.default.readFileSync(coveragePath, "utf-8")).total;
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
