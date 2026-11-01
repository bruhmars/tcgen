"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementTestPlanSchema = exports.RequirementTestCaseSchema = exports.TraceabilityItemSchema = exports.PrioritySchema = exports.ApiTestPlanSchema = exports.ApiTestCaseSchema = exports.FunctionTestsSchema = exports.TestCaseSchema = void 0;
const zod_1 = require("zod");
// Helper to normalize test categories across different LLM responses
function normalizeCategory(val) {
    if (typeof val !== "string")
        return "happy";
    const s = val.toLowerCase().trim();
    if (s.includes("edge") || s.includes("bound") || s.includes("limit") || s.includes("corner")) {
        return "edge";
    }
    if (s.includes("neg") || s.includes("error") || s.includes("fail") || s.includes("invalid") || s.includes("throw")) {
        return "negative";
    }
    return "happy";
}
// ==========================================
// 1. Code Unit Test Schemas
// ==========================================
exports.TestCaseSchema = zod_1.z.object({
    name: zod_1.z.string().default("Unnamed test"),
    category: zod_1.z.preprocess(normalizeCategory, zod_1.z.enum(["happy", "edge", "negative"])),
    args: zod_1.z.preprocess((val) => (Array.isArray(val) ? val : []), zod_1.z.array(zod_1.z.any())),
    shouldThrow: zod_1.z.preprocess((val) => Boolean(val), zod_1.z.boolean()).default(false),
    expected: zod_1.z.any().optional(),
    reason: zod_1.z.preprocess((val) => (typeof val === "string" ? val : ""), zod_1.z.string()).default(""),
    note: zod_1.z.string().optional(),
});
exports.FunctionTestsSchema = zod_1.z.object({
    tests: zod_1.z.array(exports.TestCaseSchema).min(1),
});
// ==========================================
// 2. API Endpoint Test Case Schemas (Mallikarjun pattern)
// ==========================================
exports.ApiTestCaseSchema = zod_1.z.object({
    id: zod_1.z.string().optional().default(() => `API-${Math.floor(1000 + Math.random() * 9000)}`),
    name: zod_1.z.string(),
    category: zod_1.z.preprocess(normalizeCategory, zod_1.z.enum(["happy", "edge", "negative"])),
    preCondition: zod_1.z.string().default("None"),
    method: zod_1.z.string().default("GET"),
    endpoint: zod_1.z.string().default("/"),
    headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    queryParams: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    payload: zod_1.z.any().optional(),
    expectedStatus: zod_1.z.number().default(200),
    steps: zod_1.z.array(zod_1.z.string()).min(1),
    expectedResults: zod_1.z.array(zod_1.z.string()).min(1),
});
exports.ApiTestPlanSchema = zod_1.z.object({
    endpoint: zod_1.z.string(),
    method: zod_1.z.string(),
    description: zod_1.z.string().optional().default(""),
    testCases: zod_1.z.array(exports.ApiTestCaseSchema).min(1),
});
// ==========================================
// 3. Requirement / PRD Test Schemas (EmptyRabbit pattern)
// ==========================================
exports.PrioritySchema = zod_1.z.preprocess((val) => {
    if (typeof val === "string") {
        const s = val.toUpperCase().trim();
        if (s.includes("0") || s.includes("BLOCKER") || s.includes("SMOKE"))
            return "P0";
        if (s.includes("1") || s.includes("HIGH") || s.includes("CRITICAL"))
            return "P1";
        if (s.includes("2") || s.includes("MED"))
            return "P2";
        if (s.includes("3") || s.includes("LOW"))
            return "P3";
    }
    return "P1";
}, zod_1.z.enum(["P0", "P1", "P2", "P3"]));
exports.TraceabilityItemSchema = zod_1.z.object({
    reqId: zod_1.z.string(),
    reqDescription: zod_1.z.string(),
    module: zod_1.z.string(),
    submodule: zod_1.z.string().optional().default(""),
    testPoint: zod_1.z.string(),
    testCaseIds: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.RequirementTestCaseSchema = zod_1.z.object({
    id: zod_1.z.string(), // e.g. TC0001
    reqId: zod_1.z.string(), // e.g. REQ-001
    name: zod_1.z.string(),
    module: zod_1.z.string(),
    priority: exports.PrioritySchema,
    category: zod_1.z.preprocess(normalizeCategory, zod_1.z.enum(["happy", "edge", "negative"])),
    preCondition: zod_1.z.string().default("None"),
    steps: zod_1.z.array(zod_1.z.string()).min(1),
    expectedResults: zod_1.z.array(zod_1.z.string()).min(1),
});
exports.RequirementTestPlanSchema = zod_1.z.object({
    title: zod_1.z.string().default("Requirement Test Plan"),
    traceabilityMatrix: zod_1.z.array(exports.TraceabilityItemSchema).default([]),
    testCases: zod_1.z.array(exports.RequirementTestCaseSchema).min(1),
});
