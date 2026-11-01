import { z } from "zod";

// Helper to normalize test categories across different LLM responses
function normalizeCategory(val: unknown): "happy" | "edge" | "negative" {
  if (typeof val !== "string") return "happy";
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

export const TestCaseSchema = z.object({
  name: z.string().default("Unnamed test"),
  category: z.preprocess(normalizeCategory, z.enum(["happy", "edge", "negative"])),
  args: z.preprocess((val) => (Array.isArray(val) ? val : []), z.array(z.any())),
  shouldThrow: z.preprocess((val) => Boolean(val), z.boolean()).default(false),
  expected: z.any().optional(),
  reason: z.preprocess((val) => (typeof val === "string" ? val : ""), z.string()).default(""),
  note: z.string().optional(),
});

export const FunctionTestsSchema = z.object({
  tests: z.array(TestCaseSchema).min(1),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

// ==========================================
// 2. API Endpoint Test Case Schemas (Mallikarjun pattern)
// ==========================================

export const ApiTestCaseSchema = z.object({
  id: z.string().optional().default(() => `API-${Math.floor(1000 + Math.random() * 9000)}`),
  name: z.string(),
  category: z.preprocess(normalizeCategory, z.enum(["happy", "edge", "negative"])),
  preCondition: z.string().default("None"),
  method: z.string().default("GET"),
  endpoint: z.string().default("/"),
  headers: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.any()).optional(),
  payload: z.any().optional(),
  expectedStatus: z.number().default(200),
  steps: z.array(z.string()).min(1),
  expectedResults: z.array(z.string()).min(1),
});

export const ApiTestPlanSchema = z.object({
  endpoint: z.string(),
  method: z.string(),
  description: z.string().optional().default(""),
  testCases: z.array(ApiTestCaseSchema).min(1),
});

export type ApiTestCase = z.infer<typeof ApiTestCaseSchema>;
export type ApiTestPlan = z.infer<typeof ApiTestPlanSchema>;

// ==========================================
// 3. Requirement / PRD Test Schemas (EmptyRabbit pattern)
// ==========================================

export const PrioritySchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const s = val.toUpperCase().trim();
    if (s.includes("0") || s.includes("BLOCKER") || s.includes("SMOKE")) return "P0";
    if (s.includes("1") || s.includes("HIGH") || s.includes("CRITICAL")) return "P1";
    if (s.includes("2") || s.includes("MED")) return "P2";
    if (s.includes("3") || s.includes("LOW")) return "P3";
  }
  return "P1";
}, z.enum(["P0", "P1", "P2", "P3"]));

export const TraceabilityItemSchema = z.object({
  reqId: z.string(),
  reqDescription: z.string(),
  module: z.string(),
  submodule: z.string().optional().default(""),
  testPoint: z.string(),
  testCaseIds: z.array(z.string()).default([]),
});

export const RequirementTestCaseSchema = z.object({
  id: z.string(), // e.g. TC0001
  reqId: z.string(), // e.g. REQ-001
  name: z.string(),
  module: z.string(),
  priority: PrioritySchema,
  category: z.preprocess(normalizeCategory, z.enum(["happy", "edge", "negative"])),
  preCondition: z.string().default("None"),
  steps: z.array(z.string()).min(1),
  expectedResults: z.array(z.string()).min(1),
});

export const RequirementTestPlanSchema = z.object({
  title: z.string().default("Requirement Test Plan"),
  traceabilityMatrix: z.array(TraceabilityItemSchema).default([]),
  testCases: z.array(RequirementTestCaseSchema).min(1),
});

export type Priority = z.infer<typeof PrioritySchema>;
export type TraceabilityItem = z.infer<typeof TraceabilityItemSchema>;
export type RequirementTestCase = z.infer<typeof RequirementTestCaseSchema>;
export type RequirementTestPlan = z.infer<typeof RequirementTestPlanSchema>;
