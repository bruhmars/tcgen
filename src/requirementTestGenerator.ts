import type { LLMProvider } from "./llm";
import { RequirementTestPlan, RequirementTestPlanSchema } from "./schema";

export interface GenerateRequirementOptions {
  title?: string;
  requirementText: string;
  moduleFilter?: string;
  extraContext?: string;
}

const SYSTEM_PROMPT = `You are a Principal QA Architect and Test Case Designer.
Your task is to analyze product requirement documents, user stories, and technical specifications, then generate an exhaustive QA test suite with full Requirements Traceability Matrix (RTM).

Core Design Principles:
1. Singularity: Each test case must verify one single specific scenario or business rule.
2. Independence: Decouple cases so each can execute independently with clear preconditions and expected outcomes.
3. Priority Allocation:
   - P0 (Blocker / Smoke): Core business logic, critical happy paths, system crash hazards.
   - P1 (High): Major features, primary error handling, data integrity, security.
   - P2 (Medium): Secondary flows, common edge cases, UI/UX validation, non-blocking errors.
   - P3 (Low): Minor corner cases, cosmetic text, low-frequency edge interactions.
4. Comprehensive Coverage:
   - Happy paths (positive verification).
   - Negative paths (invalid inputs, authorization failures, exception paths).
   - Boundary Value Analysis (BVA: min/max lengths, numeric limits, empty states).
   - Multi-scenario (role-based access, concurrent edits, state transitions).
5. Requirements Traceability:
   - Map each requirement to a unique reqId (e.g. REQ-001, REQ-002).
   - Map each test case to a unique test case id (e.g. TC0001, TC0002).
   - Cross-link them in the traceabilityMatrix.

Output Format:
- Reply ONLY with a valid JSON object matching the requested schema. No markdown code blocks, no extraneous text.
- NEVER put JavaScript/TypeScript functions, arrow functions, callbacks, or any code expressions inside JSON values. All JSON values must be plain strings, numbers, booleans, arrays, or objects containing plain data only.`;

function buildRequirementPrompt(opts: GenerateRequirementOptions): string {
  return `Product Requirements / User Story / Specification:
${opts.requirementText}

Project / Feature Title: ${opts.title || "Feature Test Plan"}
${opts.moduleFilter ? `Focus Modules: ${opts.moduleFilter}` : ""}
${opts.extraContext ? `Additional Constraints: ${opts.extraContext}` : ""}

Generate a comprehensive test plan JSON object in this exact shape:
{
  "title": "${opts.title || "Feature Test Plan"}",
  "traceabilityMatrix": [
    {
      "reqId": "REQ-001",
      "reqDescription": "Description of the requirement",
      "module": "Authentication",
      "submodule": "Login",
      "testPoint": "Verify login succeeds with valid email and password",
      "testCaseIds": ["TC0001", "TC0002"]
    }
  ],
  "testCases": [
    {
      "id": "TC0001",
      "reqId": "REQ-001",
      "name": "Successful login with registered credentials",
      "module": "Authentication",
      "priority": "P0",
      "category": "happy",
      "preCondition": "User account exists and is active",
      "steps": [
        "Navigate to login page",
        "Enter registered email and password",
        "Click Submit"
      ],
      "expectedResults": [
        "Authentication token is issued",
        "User redirected to dashboard"
      ]
    }
  ]
}`;
}

function extractJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    return cleaned.slice(start, end + 1);
  }
  throw new Error("No JSON found in LLM reply");
}

export async function generateRequirementTestPlan(
  llm: LLMProvider,
  options: GenerateRequirementOptions
): Promise<RequirementTestPlan> {
  const maxTries = 3;
  const basePrompt = buildRequirementPrompt(options);
  let prompt = basePrompt;

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const raw = await llm.generate(SYSTEM_PROMPT, prompt);

    try {
      const jsonStr = extractJson(raw);
      const parsed = JSON.parse(jsonStr);

      if (!parsed.title) parsed.title = options.title || "Requirement Test Plan";
      if (!parsed.traceabilityMatrix) parsed.traceabilityMatrix = [];

      const result = RequirementTestPlanSchema.safeParse(parsed);
      if (result.success) {
        // Backfill testCaseIds into traceabilityMatrix if LLM forgot to cross-link
        const plan = result.data;
        const reqToCases = new Map<string, string[]>();
        for (const tc of plan.testCases) {
          if (!reqToCases.has(tc.reqId)) reqToCases.set(tc.reqId, []);
          reqToCases.get(tc.reqId)!.push(tc.id);
        }
        for (const tm of plan.traceabilityMatrix) {
          if (!tm.testCaseIds || tm.testCaseIds.length === 0) {
            tm.testCaseIds = reqToCases.get(tm.reqId) || [];
          }
        }
        return plan;
      }

      throw new Error(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    } catch (err: any) {
      llm.forget?.(SYSTEM_PROMPT, prompt);
      prompt =
        basePrompt +
        `\n\nYour previous JSON was invalid: ${err.message}\nReply again strictly with valid JSON only.`;
    }
  }

  throw new Error(`Could not generate valid requirement test plan after ${maxTries} attempts.`);
}
