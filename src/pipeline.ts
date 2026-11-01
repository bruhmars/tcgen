import fs from "node:fs";
import path from "node:path";
import { Project } from "ts-morph";
import type { LLMProvider } from "./llm";
import { extractFunctions } from "./parser";
import { generateTestCode } from "./generator";
import { runTests } from "./runner";
import type { RunResult } from "./runner";

export interface PipelineOptions {
  outputDir?: string;
  maxRepairRounds?: number;
  log?: (message: string) => void;
}

export interface PipelineResult {
  filePath: string;
  testFile: string;
  functionNames: string[];
  testCount: number;
  repaired: number;
  seconds: number;
  firstRun: RunResult; // results BEFORE any repair
  run: RunResult;      // results at the end
}

// ─── Code-based repair ───────────────────────────────────────────────────────

const REPAIR_SYSTEM_PROMPT =
  "You are a senior TypeScript test engineer reviewing failing Vitest tests. " +
  "You reply with a single corrected TypeScript code block only. No JSON. No explanations outside the code block.";

function buildRepairPrompt(
  fnSource: string,
  currentCode: string,
  failures: { title: string; message: string }[],
  previousError?: string
): string {
  const failureList = failures
    .slice(0, 6)
    .map((f) => `  • "${f.title}"\n    ${f.message}`)
    .join("\n");

  const errorSection = previousError
    ? `\n\nYour previous fix had a syntax error:\n${previousError}\nFix it.\n`
    : "";

  return `The following Vitest tests are failing. Fix ONLY what is wrong.

Function source:
\`\`\`typescript
${fnSource}
\`\`\`

Current test code:
\`\`\`typescript
${currentCode}
\`\`\`

Failing tests:
${failureList}

Instructions:
1. Figure out the correct expected values by reading the function source carefully.
2. If a test's expected value is wrong, correct it.
3. If a test relies on async/mock behaviour, add the correct vi.fn() / vi.spyOn() setup.
4. Output the COMPLETE corrected describe block — do not omit passing tests.
5. Output ONLY the TypeScript code block. No JSON. No explanations.
6. Do NOT add any import statements — the test runner already imports everything needed.
${errorSection}`;
}

// ─── Syntax checker & fence stripper ─────────────────────────────────────────

// Reuse one in-memory ts-morph project for syntax checks
const _syntaxProject = new Project({
  useInMemoryFileSystem: true,
  compilerOptions: { strict: false, noEmit: true },
});

function stripFences(raw: string): string {
  const fencePattern = /^```(?:typescript|ts)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const match = raw.trim().match(fencePattern);
  if (match) return match[1].trim();
  if (!raw.includes("```")) return raw.trim();
  const firstOpen = raw.indexOf("```");
  const lastClose = raw.lastIndexOf("```");
  if (firstOpen !== -1 && lastClose > firstOpen) {
    const inner = raw.slice(firstOpen, lastClose + 3);
    return stripFences(inner);
  }
  return raw.trim();
}

function checkSyntax(code: string): string | null {
  const fileName = `_check_${Date.now()}.ts`;
  const sourceFile = _syntaxProject.createSourceFile(fileName, code, { overwrite: true });

  // Use only syntactic diagnostics — semantic errors (unknown names, missing modules)
  // are expected in a partial test file and should NOT cause a retry.
  const compilerSourceFile = _syntaxProject.getProgram().compilerObject.getSourceFile(fileName);
  const syntaxErrors = compilerSourceFile
    ? _syntaxProject.getProgram().compilerObject.getSyntacticDiagnostics(compilerSourceFile)
    : [];

  _syntaxProject.removeSourceFile(sourceFile);

  if (syntaxErrors.length === 0) return null;

  return Array.from(syntaxErrors)
    .map((d) => {
      const line = code.slice(0, d.start ?? 0).split("\n").length;
      return `Line ${line}: ${typeof d.messageText === "string" ? d.messageText : (d.messageText as any).messageText}`;
    })
    .join("\n");
}

async function repairTestCode(
  llm: LLMProvider,
  fnSource: string,
  currentCode: string,
  failures: { title: string; message: string }[]
): Promise<string | null> {
  const maxTries = 2;
  let previousError: string | undefined;

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const prompt = buildRepairPrompt(fnSource, currentCode, failures, previousError);
    const raw = await llm.generate(REPAIR_SYSTEM_PROMPT, prompt);
    const code = stripFences(raw);

    const syntaxError = checkSyntax(code);
    if (syntaxError) {
      llm.forget?.(REPAIR_SYSTEM_PROMPT, prompt);
      previousError = syntaxError;
      continue;
    }

    // Valid — persist. Also strip any stray imports the model added.
    const cleanCode = code.replace(/^import\s+[^;]+;\s*\n?/gm, "").trim();
    (llm as any).save?.(REPAIR_SYSTEM_PROMPT, prompt, raw);
    return cleanCode;
  }
  return null;
}

// ─── File builder ─────────────────────────────────────────────────────────────

function buildTestFile(
  importPath: string,
  fnNames: string[],
  describeBlocks: string[]
): string {
  const importList = fnNames.join(", ");

  // Strip ALL import statements from blocks — we add the correct ones at the top.
  // Also collect any extra vitest exports used (beforeEach, afterEach, etc.)
  const vitestNames = new Set(["describe", "it", "expect", "vi"]);
  const allVitestExports = ["beforeEach", "afterEach", "beforeAll", "afterAll", "test"];
  const joined = describeBlocks.join("\n");
  for (const name of allVitestExports) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(joined)) vitestNames.add(name);
  }
  const cleanBlocks = describeBlocks.map((b) =>
    b.replace(/^import\s+[^;]+;\s*\n?/gm, "").trim()
  );

  return (
    `import { ${[...vitestNames].join(", ")} } from "vitest";\n` +
    `import { ${importList} } from ${JSON.stringify(importPath)};\n\n` +
    cleanBlocks.join("\n\n") +
    "\n"
  );
}

// Count `it(` calls to estimate test count
function countTests(code: string): number {
  return (code.match(/\bit\s*\(/g) ?? []).length;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function runPipeline(
  filePath: string,
  llm: LLMProvider,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const log = options.log ?? console.log;
  const outputDir = options.outputDir ?? "generated";
  const maxRounds = options.maxRepairRounds ?? 2;
  const started = Date.now();

  // 1. Read the code
  const functions = extractFunctions(filePath);
  if (functions.length === 0) throw new Error(`No exported functions found in ${filePath}`);
  log(`Found ${functions.length} function(s): ${functions.map((f) => f.name).join(", ")}`);

  // 2. Ask the AI for tests — each function gets a describe block as raw code
  const describeBlocks: string[] = [];
  for (const fn of functions) {
    log(`Generating tests for ${fn.name}...`);
    describeBlocks.push(await generateTestCode(llm, fn));
  }

  // 3. Write the test file
  const baseName = path.basename(filePath, ".ts");
  const testFile = path.join(outputDir, `${baseName}.test.ts`);
  const importPath = path
    .relative(outputDir, filePath.replace(/\.ts$/, ""))
    .split(path.sep)
    .join("/");
  const fnNames = functions.map((f) => f.name);

  fs.mkdirSync(outputDir, { recursive: true });
  const write = () =>
    fs.writeFileSync(testFile, buildTestFile(importPath, fnNames, describeBlocks));
  write();

  // 4. Run, and repair failures
  log("Running the tests...");
  let run = runTests(testFile, filePath);
  const firstRun = run;
  let repaired = 0;

  for (let round = 1; round <= maxRounds; round++) {
    if (run.crashed || run.failures.length === 0) break;

    log(`Round ${round}: ${run.failures.length} test(s) failed. Asking the AI to review them...`);
    let changed = false;

    for (let i = 0; i < functions.length; i++) {
      const fn = functions[i];
      const fails = run.failures.filter((f) => f.fnName === fn.name);
      if (fails.length === 0) continue;

      const fixed = await repairTestCode(llm, fn.source, describeBlocks[i], fails);
      if (fixed && fixed !== describeBlocks[i]) {
        repaired += fails.length;
        describeBlocks[i] = fixed;
        changed = true;
        log(`  ${fn.name}: repaired ${fails.length} failing test(s).`);
      }
    }

    if (!changed) break;
    write();
    log("Running the tests again...");
    run = runTests(testFile, filePath);
  }

  const totalTests = countTests(describeBlocks.join("\n"));

  return {
    filePath,
    testFile,
    functionNames: fnNames,
    testCount: totalTests,
    repaired,
    seconds: Math.round((Date.now() - started) / 1000),
    firstRun,
    run,
  };
}
