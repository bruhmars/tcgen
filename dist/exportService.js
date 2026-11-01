"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportApiTestsToCsv = exportApiTestsToCsv;
exports.exportRequirementTestsToCsv = exportRequirementTestsToCsv;
exports.exportRequirementTestsToMarkdown = exportRequirementTestsToMarkdown;
exports.exportApiTestsToMarkdown = exportApiTestsToMarkdown;
exports.exportToMindMapJson = exportToMindMapJson;
function escapeCsvField(val) {
    if (val === undefined || val === null)
        return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}
/**
 * Exports API test cases to CSV format.
 * Reverse-engineered from rajeshbakthavachalam/ai-testcase-generator.
 */
function exportApiTestsToCsv(testCases) {
    const headers = [
        "Test Case ID",
        "Test Name",
        "Category",
        "Pre-Condition",
        "Steps",
        "Expected Results",
        "Expected Status",
    ];
    const rows = testCases.map((tc, idx) => [
        escapeCsvField(tc.id || `API-${idx + 1}`),
        escapeCsvField(tc.name),
        escapeCsvField(tc.category),
        escapeCsvField(tc.preCondition || "None"),
        escapeCsvField(tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")),
        escapeCsvField(tc.expectedResults.map((r, i) => `${i + 1}. ${r}`).join("\n")),
        escapeCsvField(tc.expectedStatus || 200),
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
/**
 * Exports Requirement test cases to CSV format.
 */
function exportRequirementTestsToCsv(testCases) {
    const headers = [
        "Test Case ID",
        "Requirement ID",
        "Priority",
        "Module",
        "Test Name",
        "Category",
        "Pre-Condition",
        "Steps",
        "Expected Results",
    ];
    const rows = testCases.map((tc) => [
        escapeCsvField(tc.id),
        escapeCsvField(tc.reqId),
        escapeCsvField(tc.priority),
        escapeCsvField(tc.module),
        escapeCsvField(tc.name),
        escapeCsvField(tc.category),
        escapeCsvField(tc.preCondition || "None"),
        escapeCsvField(tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")),
        escapeCsvField(tc.expectedResults.map((r, i) => `${i + 1}. ${r}`).join("\n")),
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
/**
 * Exports Requirement Test Plan to hierarchical Markdown with RTM.
 * Reverse-engineered from EmptyRabbit/testcase-generator-mcp.
 */
function exportRequirementTestsToMarkdown(title, traceabilityMatrix, testCases) {
    const lines = [];
    lines.push(`# 📋 Test Plan: ${title}\n`);
    // Requirements Traceability Matrix Section
    lines.push("## 🔗 Requirements Traceability Matrix (RTM)\n");
    lines.push("| Requirement ID | Module | Requirement Description | Test Point / Focus | Linked Test Cases |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const tm of traceabilityMatrix) {
        const linked = tm.testCaseIds.length > 0 ? tm.testCaseIds.join(", ") : "-";
        lines.push(`| **${tm.reqId}** | ${tm.module} | ${tm.reqDescription} | ${tm.testPoint} | ${linked} |`);
    }
    lines.push("\n---\n");
    // Group test cases by Module
    const modules = new Map();
    for (const tc of testCases) {
        const m = tc.module || "General";
        if (!modules.has(m))
            modules.set(m, []);
        modules.get(m).push(tc);
    }
    lines.push("## 🧪 Test Cases\n");
    for (const [moduleName, cases] of modules.entries()) {
        lines.push(`### Module: ${moduleName}\n`);
        for (const tc of cases) {
            lines.push(`#### 【${tc.priority}】 ${tc.id}: ${tc.name}`);
            lines.push(`- **Requirement ID**: \`${tc.reqId}\``);
            lines.push(`- **Category**: \`${tc.category}\``);
            lines.push(`- **Pre-Condition**: ${tc.preCondition || "None"}`);
            lines.push("- **Test Steps**:");
            tc.steps.forEach((s, idx) => {
                lines.push(`  ${idx + 1}. ${s}`);
            });
            lines.push("- **Expected Results**:");
            tc.expectedResults.forEach((r, idx) => {
                lines.push(`  - 🎯 ${r}`);
            });
            lines.push("");
        }
    }
    return lines.join("\n");
}
/**
 * Exports API test cases to Markdown format.
 */
function exportApiTestsToMarkdown(endpoint, method, testCases) {
    const lines = [];
    lines.push(`# 🚀 API Test Plan: \`${method.toUpperCase()} ${endpoint}\`\n`);
    lines.push(`Generated: ${new Date().toISOString().slice(0, 10)} | Total Cases: ${testCases.length}\n`);
    for (const tc of testCases) {
        lines.push(`### [${tc.category.toUpperCase()}] ${tc.id || "API"}: ${tc.name}`);
        lines.push(`- **Method & Endpoint**: \`${method.toUpperCase()} ${endpoint}\``);
        lines.push(`- **Expected Status**: \`${tc.expectedStatus || 200}\``);
        lines.push(`- **Pre-Condition**: ${tc.preCondition || "None"}`);
        if (tc.payload) {
            lines.push("- **Request Payload**:");
            lines.push("```json");
            lines.push(typeof tc.payload === "string" ? tc.payload : JSON.stringify(tc.payload, null, 2));
            lines.push("```");
        }
        lines.push("- **Execution Steps**:");
        tc.steps.forEach((s, idx) => lines.push(`  ${idx + 1}. ${s}`));
        lines.push("- **Expected Assertions**:");
        tc.expectedResults.forEach((r) => lines.push(`  - ✅ ${r}`));
        lines.push("\n---\n");
    }
    return lines.join("\n");
}
/**
 * Converts test cases into a Mind Map / XMind compatible topic tree structure.
 * Reverse-engineered from EmptyRabbit/testcase-generator-mcp.
 */
function exportToMindMapJson(title, testCases) {
    const moduleGroups = new Map();
    for (const tc of testCases) {
        const mod = tc.module || tc.category || "General";
        if (!moduleGroups.has(mod))
            moduleGroups.set(mod, []);
        moduleGroups.get(mod).push({
            title: `${tc.priority ? `【${tc.priority}】` : ""}${tc.id ? `[${tc.id}] ` : ""}${tc.name}`,
        });
    }
    return {
        root: {
            title,
            topics: Array.from(moduleGroups.entries()).map(([modName, children]) => ({
                title: modName,
                topics: children,
            })),
        },
    };
}
