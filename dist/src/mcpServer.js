#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const setup_1 = require("./setup");
const generateFromCode_1 = require("./generateFromCode");
const apiTestGenerator_1 = require("./apiTestGenerator");
const requirementTestGenerator_1 = require("./requirementTestGenerator");
const excelService_1 = require("./excelService");
const exportService_1 = require("./exportService");
const pipeline_1 = require("./pipeline");
const OUT_DIR = node_path_1.default.resolve(process.cwd(), "generated");
if (!node_fs_1.default.existsSync(OUT_DIR)) {
    node_fs_1.default.mkdirSync(OUT_DIR, { recursive: true });
}
const llm = (0, setup_1.buildProvider)(false);
const server = new index_js_1.Server({
    name: "tcgen-testcase-generator-mcp",
    version: "2.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Register Available Tools
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "generate_unit_tests",
                description: "Generate executable Vitest unit test suites from JavaScript/TypeScript source code using AST analysis (branches, throws, returns) and self-verifying test generation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "JavaScript or TypeScript function(s) source code",
                        },
                    },
                    required: ["code"],
                },
            },
            {
                name: "generate_api_tests",
                description: "Generate exhaustive API test cases (Happy path, Negative validation, Boundary Value Analysis, Security/Auth) for a REST API endpoint. Optionally exports to styled Excel (.xlsx), CSV, or Markdown.",
                inputSchema: {
                    type: "object",
                    properties: {
                        endpoint: {
                            type: "string",
                            description: "API URL or endpoint route (e.g. /api/v1/users, https://api.example.com/checkout)",
                        },
                        method: {
                            type: "string",
                            description: "HTTP method: GET, POST, PUT, DELETE, PATCH",
                            default: "GET",
                        },
                        payload: {
                            type: "string",
                            description: "Request body payload or JSON schema",
                        },
                        extraContext: {
                            type: "string",
                            description: "Additional business rules, headers, or testing constraints",
                        },
                        exportFormat: {
                            type: "string",
                            enum: ["none", "excel", "csv", "markdown"],
                            description: "Export format to save in generated/ folder",
                            default: "none",
                        },
                    },
                    required: ["endpoint"],
                },
            },
            {
                name: "generate_requirement_tests",
                description: "Analyze product requirements documents (PRD), user stories, or acceptance criteria to generate an end-to-end QA test plan with full Requirements Traceability Matrix (RTM) and P0-P3 priority tagging.",
                inputSchema: {
                    type: "object",
                    properties: {
                        requirementText: {
                            type: "string",
                            description: "The product requirements, user story, or feature specification",
                        },
                        title: {
                            type: "string",
                            description: "Feature or project title",
                            default: "Feature Test Plan",
                        },
                        moduleFilter: {
                            type: "string",
                            description: "Optional focus module or category",
                        },
                        exportFormat: {
                            type: "string",
                            enum: ["none", "excel", "csv", "markdown", "xmind_json"],
                            description: "Export format to save in generated/ folder",
                            default: "none",
                        },
                    },
                    required: ["requirementText"],
                },
            },
            {
                name: "run_and_repair_tests",
                description: "Execute generated Vitest test file against a source file, identify any failing assertions, and use AI to automatically repair erroneous test assumptions or flag code bugs.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sourceFilePath: {
                            type: "string",
                            description: "Path to the implementation source file (e.g. samples/applyDiscount.ts)",
                        },
                    },
                    required: ["sourceFilePath"],
                },
            },
        ],
    };
});
// Handle Tool Executions
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "generate_unit_tests": {
                const code = String(args?.code || "");
                if (!code)
                    throw new Error("Argument 'code' is required.");
                const res = await (0, generateFromCode_1.generateFromCode)(code, llm);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                status: "success",
                                functionsAnalyzed: res.functions,
                                totalTests: res.testCount,
                                categoryBreakdown: {
                                    happy: res.cases.filter((c) => c.category === "happy").length,
                                    edge: res.cases.filter((c) => c.category === "edge").length,
                                    negative: res.cases.filter((c) => c.category === "negative").length,
                                },
                                testCode: res.testCode,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "generate_api_tests": {
                const endpoint = String(args?.endpoint || "");
                const method = String(args?.method || "GET").toUpperCase();
                const payload = args?.payload ? String(args.payload) : undefined;
                const extraContext = args?.extraContext ? String(args.extraContext) : undefined;
                const exportFormat = String(args?.exportFormat || "none");
                const plan = await (0, apiTestGenerator_1.generateApiTestPlan)(llm, {
                    endpoint,
                    method,
                    payload,
                    extraContext,
                });
                let exportInfo = null;
                if (exportFormat === "excel") {
                    const { filePath, filename } = await (0, excelService_1.generateApiTestExcel)(endpoint, method, plan.testCases, { outDir: OUT_DIR });
                    exportInfo = { format: "excel", filePath, filename };
                }
                else if (exportFormat === "csv") {
                    const csv = (0, exportService_1.exportApiTestsToCsv)(plan.testCases);
                    const fname = `api_${method.toLowerCase()}_${Date.now()}.csv`;
                    const fpath = node_path_1.default.join(OUT_DIR, fname);
                    node_fs_1.default.writeFileSync(fpath, csv, "utf-8");
                    exportInfo = { format: "csv", filePath: fpath, filename: fname };
                }
                else if (exportFormat === "markdown") {
                    const md = (0, exportService_1.exportApiTestsToMarkdown)(endpoint, method, plan.testCases);
                    const fname = `api_${method.toLowerCase()}_${Date.now()}.md`;
                    const fpath = node_path_1.default.join(OUT_DIR, fname);
                    node_fs_1.default.writeFileSync(fpath, md, "utf-8");
                    exportInfo = { format: "markdown", filePath: fpath, filename: fname };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                status: "success",
                                endpoint: plan.endpoint,
                                method: plan.method,
                                testCount: plan.testCases.length,
                                testCases: plan.testCases,
                                exportedFile: exportInfo,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "generate_requirement_tests": {
                const requirementText = String(args?.requirementText || "");
                const title = String(args?.title || "Feature Test Plan");
                const moduleFilter = args?.moduleFilter ? String(args.moduleFilter) : undefined;
                const exportFormat = String(args?.exportFormat || "none");
                const plan = await (0, requirementTestGenerator_1.generateRequirementTestPlan)(llm, {
                    requirementText,
                    title,
                    moduleFilter,
                });
                let exportInfo = null;
                if (exportFormat === "excel") {
                    const { filePath, filename } = await (0, excelService_1.generateRequirementTestExcel)(title, plan.traceabilityMatrix, plan.testCases, { outDir: OUT_DIR });
                    exportInfo = { format: "excel", filePath, filename };
                }
                else if (exportFormat === "csv") {
                    const csv = (0, exportService_1.exportRequirementTestsToCsv)(plan.testCases);
                    const fname = `req_${Date.now()}.csv`;
                    const fpath = node_path_1.default.join(OUT_DIR, fname);
                    node_fs_1.default.writeFileSync(fpath, csv, "utf-8");
                    exportInfo = { format: "csv", filePath: fpath, filename: fname };
                }
                else if (exportFormat === "markdown") {
                    const md = (0, exportService_1.exportRequirementTestsToMarkdown)(title, plan.traceabilityMatrix, plan.testCases);
                    const fname = `req_${Date.now()}.md`;
                    const fpath = node_path_1.default.join(OUT_DIR, fname);
                    node_fs_1.default.writeFileSync(fpath, md, "utf-8");
                    exportInfo = { format: "markdown", filePath: fpath, filename: fname };
                }
                else if (exportFormat === "xmind_json") {
                    const mindmap = (0, exportService_1.exportToMindMapJson)(title, plan.testCases);
                    const fname = `req_mindmap_${Date.now()}.json`;
                    const fpath = node_path_1.default.join(OUT_DIR, fname);
                    node_fs_1.default.writeFileSync(fpath, JSON.stringify(mindmap, null, 2), "utf-8");
                    exportInfo = { format: "xmind_json", filePath: fpath, filename: fname };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                status: "success",
                                title: plan.title,
                                traceabilityMatrix: plan.traceabilityMatrix,
                                testCount: plan.testCases.length,
                                testCases: plan.testCases,
                                exportedFile: exportInfo,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "run_and_repair_tests": {
                const sourceFilePath = String(args?.sourceFilePath || "");
                if (!node_fs_1.default.existsSync(sourceFilePath)) {
                    throw new Error(`File not found: ${sourceFilePath}`);
                }
                const res = await (0, pipeline_1.runPipeline)(sourceFilePath, llm, {
                    outputDir: OUT_DIR,
                    log: () => { },
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                status: "success",
                                sourceFile: res.filePath,
                                testFile: res.testFile,
                                functions: res.functionNames,
                                totalTests: res.testCount,
                                passed: res.run.passed,
                                failed: res.run.failed,
                                repaired: res.repaired,
                                flaggedCodeBugs: res.flagged,
                                coverage: res.run.coverage,
                                durationSeconds: res.seconds,
                            }, null, 2),
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Error executing ${name}: ${error.message || String(error)}`,
                },
            ],
        };
    }
});
// Start Stdio Transport
async function run() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("tcgen MCP Server running on stdio");
}
run().catch((err) => {
    console.error("Fatal error starting tcgen MCP server:", err);
    process.exit(1);
});
