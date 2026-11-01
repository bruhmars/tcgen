import { Project } from "ts-morph";
import type { LLMProvider } from "./llm";
import type { FunctionInfo } from "./parser";

// Reuse one in-memory ts-morph project for all syntax checks (avoids repeated setup cost)
const _syntaxProject = new Project({
  useInMemoryFileSystem: true,
  compilerOptions: { strict: false, noEmit: true },
});

const SYSTEM_PROMPT =
  "You are a senior TypeScript test engineer. You write Vitest test suites. " +
  "You reply with a single TypeScript code block only. No JSON. No explanations outside the code block.";

function buildPrompt(fn: FunctionInfo, previousError?: string): string {
  const params = fn.params.map((p) => `${p.name}: ${p.type}`).join(", ");

  const errorSection = previousError
    ? `\n\nYour previous code had a syntax error:\n${previousError}\nFix it and try again.\n`
    : "";

  return `Write a complete Vitest test suite (a single \`describe\` block) for the following TypeScript function.

Function: ${fn.name}(${params}) returns ${fn.returnType}
Description: ${fn.doc || "(none)"}
Branch conditions (if/ternary): ${fn.conditions.length ? fn.conditions.join(" | ") : "(none)"}
Errors thrown: ${fn.throws.length ? fn.throws.join(" | ") : "(none)"}

Source code:
\`\`\`typescript
${fn.source}
\`\`\`

Requirements:
1. Cover standard happy path scenarios.
2. Cover boundary value analysis (BVA), off-by-one, 0, null, empty strings/arrays, and edge conditions.
3. Cover negative cases and every error condition that triggers throws.
4. Use \`vi.fn()\`, \`vi.spyOn()\`, or \`vi.mock()\` when the function uses external dependencies (fetch, fs, Date, etc.).
5. Include \`import { describe, it, expect, vi } from "vitest";\` at the top of the code block.
6. Do NOT import the function under test — just call \`${fn.name}(...)\` directly (the test runner will inject it).

Output ONLY the TypeScript code block. No JSON. No markdown text outside the fences. No explanations.
Example format:
\`\`\`typescript
import { describe, it, expect, vi } from "vitest";

describe("${fn.name}", () => {
  it("[happy] does the expected thing", () => {
    expect(${fn.name}(/* args */)).toEqual(/* expected */);
  });
});
\`\`\`
${errorSection}`;
}

/** Strip ```typescript / ```ts / ``` fences and return the inner code. */
function stripFences(raw: string): string {
  const fencePattern = /^```(?:typescript|ts)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const match = raw.trim().match(fencePattern);
  if (match) return match[1].trim();

  // Fallback: if there are no fences at all, treat the whole reply as code
  if (!raw.includes("```")) return raw.trim();

  // Multiple fence blocks — take everything between first ``` and last ```
  const firstOpen = raw.indexOf("```");
  const lastClose = raw.lastIndexOf("```");
  if (firstOpen !== -1 && lastClose > firstOpen) {
    const inner = raw.slice(firstOpen, lastClose + 3);
    return stripFences(inner);
  }
  return raw.trim();
}

/** Check TypeScript syntax using ts-morph. Returns null if OK, or an error message. */
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

/**
 * Ask the LLM for a complete Vitest describe-block for one function.
 * Returns the raw TypeScript code string (no JSON parsing involved).
 */
export async function generateTestCode(llm: LLMProvider, fn: FunctionInfo): Promise<string> {
  const maxTries = 3;
  let previousError: string | undefined;

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const prompt = buildPrompt(fn, previousError);
    const raw = await llm.generate(SYSTEM_PROMPT, prompt);

    // Strip markdown fences
    const code = stripFences(raw);

    // Syntax-check
    const syntaxError = checkSyntax(code);
    if (syntaxError) {
      llm.forget?.(SYSTEM_PROMPT, prompt);
      console.log(`  Code had syntax errors (try ${attempt}/${maxTries}).`);
      console.log(`  ${syntaxError.slice(0, 300)}`);
      previousError = syntaxError;
      continue;
    }

    // Valid code — tell the cache to persist it
    (llm as any).save?.(SYSTEM_PROMPT, prompt, raw);
    return code;
  }

  throw new Error(`Could not get valid test code for ${fn.name} after ${maxTries} tries.`);
}
