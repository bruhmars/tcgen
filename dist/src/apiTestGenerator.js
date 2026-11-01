"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiTestPlan = generateApiTestPlan;
const schema_1 = require("./schema");
const SYSTEM_PROMPT = `You are a principal QA Automation Architect specializing in API testing, boundary value analysis (BVA), and security testing.
Your task is to generate an exhaustive, industry-grade API test plan.

Guidelines:
1. Cover Positive / Happy Path scenarios:
   - Valid payloads, default parameters, optional parameter combinations.
   - Status codes: 200 OK, 201 Created, 204 No Content as applicable.
2. Cover Negative Scenarios:
   - Missing mandatory fields.
   - Wrong data types (string instead of int, boolean instead of array).
   - Malformed JSON / body parsing errors.
   - Status codes: 400 Bad Request, 422 Unprocessable Entity.
3. Cover Boundary Value Analysis (BVA):
   - Off-by-one string lengths (min - 1, min, max, max + 1).
   - Numeric boundaries (0, negative numbers, INT_MAX, floating precision).
   - Empty strings, empty arrays, large payloads.
4. Cover Security & Auth / Access Control:
   - Missing Authorization token / API key (401 Unauthorized).
   - Invalid or expired token (401 / 403 Forbidden).
   - Basic SQL injection / NoSQL injection / XSS strings in inputs.
5. Provide concrete step-by-step instructions in "steps" and assertive validation points in "expectedResults".

Strict Requirement:
Reply ONLY with a valid JSON object matching the requested schema. No markdown backticks, no commentary before or after.`;
function buildApiPrompt(opts) {
    const method = (opts.method || "GET").toUpperCase();
    const payloadStr = opts.payload
        ? typeof opts.payload === "string"
            ? opts.payload
            : JSON.stringify(opts.payload, null, 2)
        : "None";
    return `Endpoint to Test: ${opts.endpoint}
HTTP Method: ${method}
Request Payload / Schema:
${payloadStr}

Additional Context / Constraints:
${opts.extraContext || "Standard REST API guidelines apply."}

Generate the test plan as a JSON object with this exact shape:
{
  "endpoint": "${opts.endpoint}",
  "method": "${method}",
  "description": "Comprehensive test plan for ${opts.endpoint}",
  "testCases": [
    {
      "id": "API-001",
      "name": "Verify successful response with valid payload",
      "category": "happy",
      "preCondition": "Valid user authentication token available",
      "method": "${method}",
      "endpoint": "${opts.endpoint}",
      "expectedStatus": 200,
      "steps": [
        "Construct request with valid headers and payload",
        "Send ${method} request to ${opts.endpoint}",
        "Inspect response status and body schema"
      ],
      "expectedResults": [
        "HTTP status code matches expectedStatus",
        "Response payload conforms to schema",
        "Returned identifiers match input payload"
      ]
    }
  ]
}`;
}
function extractJson(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
        return cleaned.slice(start, end + 1);
    }
    const startArr = cleaned.indexOf("[");
    const endArr = cleaned.lastIndexOf("]");
    if (startArr !== -1 && endArr !== -1) {
        return `{"endpoint":"/","method":"GET","testCases":${cleaned.slice(startArr, endArr + 1)}}`;
    }
    throw new Error("No JSON found in LLM reply");
}
async function generateApiTestPlan(llm, options) {
    const maxTries = 3;
    const basePrompt = buildApiPrompt(options);
    let prompt = basePrompt;
    for (let attempt = 1; attempt <= maxTries; attempt++) {
        const raw = await llm.generate(SYSTEM_PROMPT, prompt);
        try {
            const jsonStr = extractJson(raw);
            const parsed = JSON.parse(jsonStr);
            // Ensure endpoint and method match
            if (!parsed.endpoint)
                parsed.endpoint = options.endpoint;
            if (!parsed.method)
                parsed.method = options.method || "GET";
            if (!parsed.testCases && Array.isArray(parsed.tests))
                parsed.testCases = parsed.tests;
            const result = schema_1.ApiTestPlanSchema.safeParse(parsed);
            if (result.success)
                return result.data;
            throw new Error(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
        }
        catch (err) {
            llm.forget?.(SYSTEM_PROMPT, prompt);
            prompt =
                basePrompt +
                    `\n\nYour previous JSON was invalid: ${err.message}\nReply again strictly with valid JSON only.`;
        }
    }
    throw new Error(`Could not generate valid API test plan for ${options.endpoint} after ${maxTries} attempts.`);
}
