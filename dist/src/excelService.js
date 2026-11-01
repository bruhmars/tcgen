"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiTestExcel = generateApiTestExcel;
exports.generateRequirementTestExcel = generateRequirementTestExcel;
const exceljs_1 = __importDefault(require("exceljs"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
/**
 * Creates an Excel (.xlsx) workbook for API endpoint test cases.
 * Reverse-engineered from Mallikarjun-Roddannavar/ai-testcase-generator-mcp.
 */
async function generateApiTestExcel(endpoint, method, testCases, options = {}) {
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = "tcgen AI Testcase Generator";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet(options.sheetName || "API Test Plan");
    // Title row
    worksheet.mergeCells("A1:G1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `API Test Plan: [${method.toUpperCase()}] ${endpoint}`;
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F497D" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 32;
    // Header row
    const headers = [
        "Sl No",
        "Test Case ID",
        "Test Case Name",
        "Category",
        "Pre-Condition",
        "Steps",
        "Expected Results",
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
        cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "medium" },
            right: { style: "thin" },
        };
    });
    // Data rows
    testCases.forEach((tc, idx) => {
        const stepsFormatted = tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
        const resultsFormatted = tc.expectedResults.map((r, i) => `${i + 1}. ${r}`).join("\n");
        const row = worksheet.addRow([
            idx + 1,
            tc.id || `API-${idx + 1}`,
            tc.name,
            tc.category.toUpperCase(),
            tc.preCondition || "None",
            stepsFormatted,
            resultsFormatted,
        ]);
        row.height = Math.max(30, Math.max(tc.steps.length, tc.expectedResults.length) * 18);
        const isEven = idx % 2 === 0;
        row.eachCell((cell, colNum) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = {
                vertical: "top",
                horizontal: colNum <= 4 ? "center" : "left",
                wrapText: true,
            };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: isEven ? "FFFFFFFF" : "FFF2F4F8" },
            };
            cell.border = {
                top: { style: "thin", color: { argb: "FFD9D9D9" } },
                left: { style: "thin", color: { argb: "FFD9D9D9" } },
                bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
                right: { style: "thin", color: { argb: "FFD9D9D9" } },
            };
        });
    });
    // Column widths
    worksheet.columns = [
        { width: 8 }, // Sl No
        { width: 14 }, // Test ID
        { width: 32 }, // Test Name
        { width: 14 }, // Category
        { width: 22 }, // Pre-Condition
        { width: 45 }, // Steps
        { width: 45 }, // Expected Results
    ];
    const safeEp = endpoint.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    const filename = options.filename || `api_tests_${method.toLowerCase()}_${safeEp}_${Date.now()}.xlsx`;
    let filePath;
    if (options.outDir) {
        node_fs_1.default.mkdirSync(options.outDir, { recursive: true });
        filePath = node_path_1.default.join(options.outDir, filename);
        await workbook.xlsx.writeFile(filePath);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, filePath, filename };
}
/**
 * Creates an Excel workbook with both Requirements Traceability Matrix (RTM) and Test Cases sheets.
 * Reverse-engineered from EmptyRabbit/testcase-generator-mcp.
 */
async function generateRequirementTestExcel(title, traceabilityMatrix, testCases, options = {}) {
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = "tcgen AI Testcase Generator";
    workbook.created = new Date();
    // 1. Requirements Traceability Matrix Sheet
    const rtmSheet = workbook.addWorksheet("Traceability Matrix");
    rtmSheet.mergeCells("A1:F1");
    const rtmTitle = rtmSheet.getCell("A1");
    rtmTitle.value = `Requirements Traceability Matrix (RTM): ${title}`;
    rtmTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    rtmTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203764" } };
    rtmTitle.alignment = { vertical: "middle", horizontal: "center" };
    rtmSheet.getRow(1).height = 30;
    rtmSheet.addRow([
        "Requirement ID",
        "Module",
        "Submodule",
        "Requirement Description",
        "Test Point / Focus",
        "Linked Test Cases",
    ]);
    const rtmHeader = rtmSheet.getRow(2);
    rtmHeader.height = 24;
    rtmHeader.eachCell((cell) => {
        cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF305496" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { top: { style: "thin" }, bottom: { style: "medium" } };
    });
    traceabilityMatrix.forEach((tm, idx) => {
        const row = rtmSheet.addRow([
            tm.reqId,
            tm.module,
            tm.submodule || "-",
            tm.reqDescription,
            tm.testPoint,
            tm.testCaseIds.join(", ") || "-",
        ]);
        row.height = 24;
        const isEven = idx % 2 === 0;
        row.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: isEven ? "FFFFFFFF" : "FFF2F4F8" },
            };
            cell.alignment = { vertical: "middle", wrapText: true };
        });
    });
    rtmSheet.columns = [
        { width: 16 }, // Req ID
        { width: 18 }, // Module
        { width: 18 }, // Submodule
        { width: 38 }, // Req Desc
        { width: 38 }, // Test Point
        { width: 22 }, // Linked Test Cases
    ];
    // 2. Test Cases Sheet
    const tcSheet = workbook.addWorksheet("Test Cases");
    tcSheet.mergeCells("A1:H1");
    const tcTitle = tcSheet.getCell("A1");
    tcTitle.value = `Test Cases: ${title}`;
    tcTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    tcTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F497D" } };
    tcTitle.alignment = { vertical: "middle", horizontal: "center" };
    tcSheet.getRow(1).height = 30;
    tcSheet.addRow([
        "Sl No",
        "Test Case ID",
        "Priority",
        "Req ID",
        "Module",
        "Test Name",
        "Pre-Condition",
        "Steps & Expected Results",
    ]);
    const tcHeader = tcSheet.getRow(2);
    tcHeader.height = 24;
    tcHeader.eachCell((cell) => {
        cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { top: { style: "thin" }, bottom: { style: "medium" } };
    });
    testCases.forEach((tc, idx) => {
        const combinedSteps = tc.steps
            .map((s, i) => `Step ${i + 1}: ${s}\n  -> Expected: ${tc.expectedResults[i] || tc.expectedResults[0] || "Pass"}`)
            .join("\n\n");
        const row = tcSheet.addRow([
            idx + 1,
            tc.id,
            tc.priority,
            tc.reqId,
            tc.module,
            tc.name,
            tc.preCondition || "None",
            combinedSteps,
        ]);
        row.height = Math.max(30, tc.steps.length * 28);
        const isEven = idx % 2 === 0;
        row.eachCell((cell, colNum) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: isEven ? "FFFFFFFF" : "FFF2F4F8" },
            };
            cell.alignment = {
                vertical: "top",
                horizontal: colNum <= 5 ? "center" : "left",
                wrapText: true,
            };
            // Color code priorities
            if (colNum === 3) {
                if (tc.priority === "P0") {
                    cell.font = { name: "Arial", bold: true, color: { argb: "FFC00000" } }; // Red
                }
                else if (tc.priority === "P1") {
                    cell.font = { name: "Arial", bold: true, color: { argb: "FFED7D31" } }; // Orange
                }
                else if (tc.priority === "P2") {
                    cell.font = { name: "Arial", color: { argb: "FF4472C4" } }; // Blue
                }
            }
        });
    });
    tcSheet.columns = [
        { width: 8 }, // Sl No
        { width: 14 }, // Test ID
        { width: 12 }, // Priority
        { width: 14 }, // Req ID
        { width: 18 }, // Module
        { width: 30 }, // Test Name
        { width: 22 }, // Pre-Condition
        { width: 60 }, // Steps & Results
    ];
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    const filename = options.filename || `req_tests_${safeTitle}_${Date.now()}.xlsx`;
    let filePath;
    if (options.outDir) {
        node_fs_1.default.mkdirSync(options.outDir, { recursive: true });
        filePath = node_path_1.default.join(options.outDir, filename);
        await workbook.xlsx.writeFile(filePath);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, filePath, filename };
}
