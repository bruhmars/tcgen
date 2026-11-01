import { z } from "zod";
import type { LLMProvider } from "./llm";
import type { FunctionInfo } from "./parser";
import type { Failure } from "./runner";
import { TestCaseSchema } from "./schema";
import type { TestCase } from "./schema";

const RepairSchema = z.object({
    reasoning: z.string(),
    verdict: z.enum(["test_wrong", "code_bug"]),
    fixedTest: TestCaseSchema.optional(),
});

const SYSTEM_PROMPT =
    "You are a careful senior test engineer reviewing a failing unit test. " +
    "You reply with JSON only. No explanations outside the JSON.";

function buildPrompt(fn: FunctionInfo, test: TestCase, failure: Failure): string {
    return `A generated unit test FAILED. Decide who is wrong: the test or the code.

Function code:
${fn.source}

Description: ${fn.doc || "(none)"}

The failing test (JSON):
${JSON.stringify(test, null, 2)}

Failure message:
${failure.message}

Instructions:
1. Work out the correct result yourself, step by step, from what the function is SUPPOSED to do. Do NOT just copy numbers from the failure message.
2. If your own result MATCHES the test's "expected" value, the test is right and the code has a bug. Reply with verdict "code_bug" (no fixedTest).
3. If your own result DIFFERS from the test's "expected" value, the test is wrong. Reply with verdict "test_wrong" and a "fixedTest" with the corrected expected value and a new "reason" that shows your calculation.
4. If the test should throw an error, "shouldThrow" is true and "expected" is left out.

Reply with JSON in this shape:
{
  "reasoning": "your step by step working",
  "verdict": "test_wrong",
  "fixedTest": { "name": "...", "category": "happy", "args": [1], "shouldThrow": false, "expected": 1, "reason": "..." }
}`;
}

async function askForVerdict(llm: LLMProvider, prompt: string) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        const raw = await llm.generate(SYSTEM_PROMPT, prompt);
        try {
            const start = raw.indexOf("{");
            const end = raw.lastIndexOf("}");
            if (start !== -1 && end !== -1) {
                let slice = raw.slice(start, end + 1)
                    .replace(/:\s*undefined\b/g, ": null")
                    .replace(/\[\s*undefined\b/g, "[null")
                    .replace(/,\s*undefined\b/g, ", null")
                    .replace(/:\s*NaN\b/g, ': "NaN"')
                    .replace(/,\s*([}\]])/g, "$1");
                const json = JSON.parse(slice);
                const parsed = RepairSchema.safeParse(json);
                if (parsed.success) return parsed.data;
            }
        } catch {
            // not valid JSON
        }
        llm.forget?.(SYSTEM_PROMPT, prompt); // don't keep a bad answer
    }
    return null;
}

export async function repairTests(
    llm: LLMProvider,
    fn: FunctionInfo,
    tests: TestCase[],
    failures: Failure[]
): Promise<{ tests: TestCase[]; repaired: number; flagged: number }> {
    const updated = [...tests];
    let repaired = 0;
    let flagged = 0;

    // Only look at the first 6 failures per round, to save your free AI limit
    for (const failure of failures.slice(0, 6)) {
        const index = updated.findIndex((t) => `[${t.category}] ${t.name}` === failure.title);
        if (index === -1) continue;

        const test = updated[index];
        if (test.note?.startsWith("POSSIBLE BUG")) continue; // already judged

        const verdict = await askForVerdict(llm, buildPrompt(fn, test, failure));
        if (!verdict) continue;

        if (verdict.verdict === "test_wrong" && verdict.fixedTest) {
            updated[index] = {
                ...verdict.fixedTest,
                name: test.name,
                category: test.category,
                note: `REPAIRED by AI (old expected value: ${JSON.stringify(test.expected)}). ${verdict.reasoning}`,
            };
            repaired++;
        } else if (verdict.verdict === "code_bug") {
            updated[index] = { ...test, note: `POSSIBLE BUG in the code: ${verdict.reasoning}` };
            flagged++;
        }
    }

    return { tests: updated, repaired, flagged };
}