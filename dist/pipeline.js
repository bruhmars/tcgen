"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPipeline = runPipeline;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const parser_1 = require("./parser");
const generator_1 = require("./generator");
const render_1 = require("./render");
const runner_1 = require("./runner");
const repair_1 = require("./repair");
async function runPipeline(filePath, llm, options = {}) {
    const log = options.log ?? console.log;
    const outputDir = options.outputDir ?? "generated";
    const maxRounds = options.maxRepairRounds ?? 2;
    const started = Date.now();
    // 1. Read the code
    const functions = (0, parser_1.extractFunctions)(filePath);
    if (functions.length === 0)
        throw new Error(`No exported functions found in ${filePath}`);
    log(`Found ${functions.length} function(s): ${functions.map((f) => f.name).join(", ")}`);
    // 2. Ask the AI for tests
    const results = [];
    for (const fn of functions) {
        log(`Generating tests for ${fn.name}...`);
        results.push({ fnName: fn.name, tests: await (0, generator_1.generateTests)(llm, fn) });
    }
    // 3. Write the test file
    const baseName = node_path_1.default.basename(filePath, ".ts");
    const testFile = node_path_1.default.join(outputDir, `${baseName}.test.ts`);
    const importPath = node_path_1.default
        .relative(outputDir, filePath.replace(/\.ts$/, ""))
        .split(node_path_1.default.sep)
        .join("/");
    node_fs_1.default.mkdirSync(outputDir, { recursive: true });
    const write = () => node_fs_1.default.writeFileSync(testFile, (0, render_1.renderTestFile)(importPath, results));
    write();
    // 4. Run, and repair failures
    log("Running the tests...");
    let run = (0, runner_1.runTests)(testFile, filePath);
    const firstRun = run;
    for (let round = 1; round <= maxRounds; round++) {
        if (run.crashed || run.failures.length === 0)
            break;
        log(`Round ${round}: ${run.failures.length} test(s) failed. Asking the AI to review them...`);
        let changed = false;
        for (const r of results) {
            const fails = run.failures.filter((f) => f.fnName === r.fnName);
            if (fails.length === 0)
                continue;
            const fn = functions.find((f) => f.name === r.fnName);
            const out = await (0, repair_1.repairTests)(llm, fn, r.tests, fails);
            r.tests = out.tests;
            if (out.repaired + out.flagged > 0)
                changed = true;
            log(`  ${r.fnName}: ${out.repaired} repaired, ${out.flagged} flagged as possible code bug`);
        }
        if (!changed)
            break;
        write();
        log("Running the tests again...");
        run = (0, runner_1.runTests)(testFile, filePath);
    }
    const allTests = results.flatMap((r) => r.tests);
    return {
        filePath,
        testFile,
        functionNames: functions.map((f) => f.name),
        testCount: allTests.length,
        repaired: allTests.filter((t) => t.note?.startsWith("REPAIRED")).length,
        flagged: allTests.filter((t) => t.note?.startsWith("POSSIBLE BUG")).length,
        seconds: Math.round((Date.now() - started) / 1000),
        firstRun,
        run,
    };
}
