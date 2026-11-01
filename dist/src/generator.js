"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTests = generateTests;
const schema_1 = require("./schema");
const SYSTEM_PROMPT = "You are a principal QA & software test engineer. You design comprehensive unit test suites for functions. " +
    "You reply with valid JSON only. Do not include markdown code fences, comments, or explanations outside the JSON.";
function buildPrompt(fn) {
    const params = fn.params.map((p) => `${p.name}: ${p.type}`).join(", ");
    return `Design thorough unit test cases for the following function.

Function: ${fn.name}(${params}) returns ${fn.returnType}
Description: ${fn.doc || "(none)"}
Branch conditions (if/ternary): ${fn.conditions.length ? fn.conditions.join(" | ") : "(none)"}
Errors thrown: ${fn.throws.length ? fn.throws.join(" | ") : "(none)"}

Code:
${fn.source}

Testing Requirements:
1. Cover standard happy path scenarios (category: "happy").
2. Cover boundary value analysis (BVA), off-by-one, 0, null/undefined, empty strings/arrays, and edge conditions (category: "edge").
3. Cover negative cases and every error condition that triggers throws (category: "negative", shouldThrow: true).
4. For each test, provide a clear reasoning step calculation in "reason".
5. "args" must be a JSON array of parameter arguments matching the function signature.

Reply ONLY with a JSON object in this format:
{
  "tests": [
    {
      "name": "descriptive test title",
      "category": "happy",
      "args": [100, 10],
      "shouldThrow": false,
      "expected": 90,
      "reason": "100 - (100 * 10 / 100) = 90"
    }
  ]
}`;
}
// Robustly extracts JSON object from LLM response
function extractJson(text) {
    // Strip markdown code block markers if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    }
    const startObj = cleaned.indexOf("{");
    const endObj = cleaned.lastIndexOf("}");
    const startArr = cleaned.indexOf("[");
    const endArr = cleaned.lastIndexOf("]");
    if (startObj !== -1 && endObj !== -1 && (startArr === -1 || startObj < startArr)) {
        return cleaned.slice(startObj, endObj + 1);
    }
    if (startArr !== -1 && endArr !== -1) {
        // If LLM returned raw array of tests, wrap in tests object
        return `{"tests": ${cleaned.slice(startArr, endArr + 1)}}`;
    }
    throw new Error("No JSON found in the reply");
}
async function generateTests(llm, fn) {
    const maxTries = 3;
    const basePrompt = buildPrompt(fn);
    let prompt = basePrompt;
    for (let attempt = 1; attempt <= maxTries; attempt++) {
        const raw = await llm.generate(SYSTEM_PROMPT, prompt);
        try {
            const jsonStr = extractJson(raw);
            const parsed = JSON.parse(jsonStr);
            // Support raw array or { tests: [...] }
            const payload = Array.isArray(parsed) ? { tests: parsed } : parsed;
            const result = schema_1.FunctionTestsSchema.safeParse(payload);
            if (result.success)
                return result.data.tests;
            throw new Error(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
        }
        catch (err) {
            llm.forget?.(SYSTEM_PROMPT, prompt);
            console.log(`  Reply was not valid (try ${attempt}/${maxTries}).`);
            console.log(`  Why: ${String(err.message).slice(0, 300)}`);
            prompt =
                basePrompt +
                    `\n\nYour previous reply was invalid: ${err.message}\nReply again strictly with valid JSON only.`;
        }
    }
    throw new Error(`Could not get valid tests for ${fn.name} after ${maxTries} tries.`);
}
