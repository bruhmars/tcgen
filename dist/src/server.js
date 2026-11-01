"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const setup_1 = require("./setup");
const generateFromCode_1 = require("./generateFromCode");
const github_1 = require("./github");
const repoGenerate_1 = require("./repoGenerate");
const apiTestGenerator_1 = require("./apiTestGenerator");
const requirementTestGenerator_1 = require("./requirementTestGenerator");
const excelService_1 = require("./excelService");
const exportService_1 = require("./exportService");
const PORT = Number(process.env.PORT) || 3000;
const MAX_CHARS = 12000;
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT) || 300;
const MAX_CONCURRENT = 3;
const llm = (0, setup_1.buildProvider)(false);
const app = (0, express_1.default)();
app.set("trust proxy", 1);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            ...helmet_1.default.contentSecurityPolicy.getDefaultDirectives(),
            "upgrade-insecure-requests": null,
        },
    },
}));
app.use(express_1.default.json({ limit: "500kb" }));
app.use(express_1.default.static(node_path_1.default.join(process.cwd(), "public")));
// ----- limits -----
function hourlyLimit(limit, message) {
    return (0, express_rate_limit_1.rateLimit)({
        windowMs: 60 * 60 * 1000,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: message },
    });
}
const pasteLimiter = hourlyLimit(30, "Rate limit reached for code generation. Please try again later.");
const scanLimiter = hourlyLimit(30, "Rate limit reached for repository scanning. Please try again later.");
const repoLimiter = hourlyLimit(15, "Rate limit reached for repository generation. Please try again later.");
const apiLimiter = hourlyLimit(30, "Rate limit reached for API test generation. Please try again later.");
const reqLimiter = hourlyLimit(30, "Rate limit reached for requirement test generation. Please try again later.");
let today = "";
let usedToday = 0;
function takeDailySlot(cost) {
    const now = new Date().toISOString().slice(0, 10);
    if (now !== today) {
        today = now;
        usedToday = 0;
    }
    if (usedToday + cost > DAILY_LIMIT)
        return false;
    usedToday += cost;
    return true;
}
let running = 0;
function sendError(res, err) {
    if (err instanceof github_1.RepoError || err instanceof generateFromCode_1.UserError) {
        return res.status(400).json({ error: err.message });
    }
    if (err instanceof repoGenerate_1.LimitError) {
        return res.status(429).json({ error: err.message });
    }
    console.error("Request failed:", err?.message ?? err);
    res.status(500).json({ error: err?.message || "Something went wrong. Please try again." });
}
// ----- routes -----
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});
// 1. Code unit test generation
app.post("/api/generate", pasteLimiter, async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!code)
        return res.status(400).json({ error: "Paste some code first." });
    if (code.length > MAX_CHARS) {
        return res.status(400).json({ error: `That's too long. The limit is ${MAX_CHARS} characters.` });
    }
    if (!takeDailySlot(2)) {
        return res.status(429).json({ error: "The free daily limit has been reached. Please come back tomorrow." });
    }
    if (running >= MAX_CONCURRENT) {
        return res.status(503).json({ error: "The server is busy right now. Please try again in a minute." });
    }
    running++;
    try {
        res.json(await (0, generateFromCode_1.generateFromCode)(code, llm));
    }
    catch (err) {
        sendError(res, err);
    }
    finally {
        running--;
    }
});
// 2. Repo mode: scan repository
app.post("/api/repo/scan", scanLimiter, async (req, res) => {
    try {
        const ref = (0, github_1.parseRepoUrl)(String(req.body?.url ?? ""));
        res.json(await (0, repoGenerate_1.scanRepo)(ref));
    }
    catch (err) {
        sendError(res, err);
    }
});
// 3. Repo mode: generate tests for selected files
app.post("/api/repo/generate", repoLimiter, async (req, res) => {
    if (running >= MAX_CONCURRENT) {
        return res.status(503).json({ error: "The server is busy right now. Please try again in a minute." });
    }
    running++;
    try {
        const ref = (0, github_1.parseRepoUrl)(String(req.body?.url ?? ""));
        const paths = Array.isArray(req.body?.paths)
            ? req.body.paths.filter((p) => typeof p === "string").slice(0, 10)
            : [];
        if (paths.length === 0)
            return res.status(400).json({ error: "Pick at least one file." });
        res.json(await (0, repoGenerate_1.generateForRepo)(ref, paths, llm, takeDailySlot));
    }
    catch (err) {
        sendError(res, err);
    }
    finally {
        running--;
    }
});
// 4. API endpoint test generation (from Mallikarjun repo pattern)
app.post("/api/api-tests", apiLimiter, async (req, res) => {
    const endpoint = String(req.body?.endpoint || "").trim();
    if (!endpoint)
        return res.status(400).json({ error: "Endpoint route is required." });
    const method = String(req.body?.method || "GET").toUpperCase();
    const payload = req.body?.payload;
    const extraContext = req.body?.extraContext ? String(req.body.extraContext) : undefined;
    if (!takeDailySlot(2)) {
        return res.status(429).json({ error: "The free daily limit has been reached. Please come back tomorrow." });
    }
    if (running >= MAX_CONCURRENT) {
        return res.status(503).json({ error: "The server is busy right now. Please try again in a minute." });
    }
    running++;
    try {
        const plan = await (0, apiTestGenerator_1.generateApiTestPlan)(llm, { endpoint, method, payload, extraContext });
        res.json(plan);
    }
    catch (err) {
        sendError(res, err);
    }
    finally {
        running--;
    }
});
// 5. Requirement / PRD test plan generation (from EmptyRabbit & Rajesh repo patterns)
app.post("/api/requirement-tests", reqLimiter, async (req, res) => {
    const requirementText = String(req.body?.requirementText || "").trim();
    if (!requirementText)
        return res.status(400).json({ error: "Requirement text or specification is required." });
    const title = String(req.body?.title || "Feature Test Plan");
    const moduleFilter = req.body?.moduleFilter ? String(req.body.moduleFilter) : undefined;
    if (!takeDailySlot(3)) {
        return res.status(429).json({ error: "The free daily limit has been reached. Please come back tomorrow." });
    }
    if (running >= MAX_CONCURRENT) {
        return res.status(503).json({ error: "The server is busy right now. Please try again in a minute." });
    }
    running++;
    try {
        const plan = await (0, requirementTestGenerator_1.generateRequirementTestPlan)(llm, { requirementText, title, moduleFilter });
        res.json(plan);
    }
    catch (err) {
        sendError(res, err);
    }
    finally {
        running--;
    }
});
// 6. Direct Export Endpoints: Excel (.xlsx), CSV, Markdown
app.post("/api/export/excel", async (req, res) => {
    try {
        const type = req.body?.type; // "api" | "requirement"
        const data = req.body?.data;
        if (!data)
            return res.status(400).json({ error: "Data is required for export." });
        if (type === "api") {
            const { buffer, filename } = await (0, excelService_1.generateApiTestExcel)(data.endpoint || "/api", data.method || "GET", data.testCases || []);
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            return res.send(buffer);
        }
        else {
            const { buffer, filename } = await (0, excelService_1.generateRequirementTestExcel)(data.title || "Requirements", data.traceabilityMatrix || [], data.testCases || []);
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            return res.send(buffer);
        }
    }
    catch (err) {
        sendError(res, err);
    }
});
app.post("/api/export/csv", (req, res) => {
    try {
        const type = req.body?.type;
        const data = req.body?.data;
        if (!data)
            return res.status(400).json({ error: "Data is required." });
        if (type === "api") {
            const csv = (0, exportService_1.exportApiTestsToCsv)(data.testCases || []);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="api_tests_${Date.now()}.csv"`);
            return res.send(csv);
        }
        else {
            const csv = (0, exportService_1.exportRequirementTestsToCsv)(data.testCases || []);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="requirement_tests_${Date.now()}.csv"`);
            return res.send(csv);
        }
    }
    catch (err) {
        sendError(res, err);
    }
});
app.post("/api/export/markdown", (req, res) => {
    try {
        const type = req.body?.type;
        const data = req.body?.data;
        if (!data)
            return res.status(400).json({ error: "Data is required." });
        if (type === "api") {
            const md = (0, exportService_1.exportApiTestsToMarkdown)(data.endpoint || "/", data.method || "GET", data.testCases || []);
            res.setHeader("Content-Type", "text/markdown; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="api_tests_${Date.now()}.md"`);
            return res.send(md);
        }
        else {
            const md = (0, exportService_1.exportRequirementTestsToMarkdown)(data.title || "Requirements", data.traceabilityMatrix || [], data.testCases || []);
            res.setHeader("Content-Type", "text/markdown; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="requirement_tests_${Date.now()}.md"`);
            return res.send(md);
        }
    }
    catch (err) {
        sendError(res, err);
    }
});
// Error handling middleware
app.use((err, _req, res, _next) => {
    res.status(err?.status === 413 ? 413 : 400).json({
        error: err?.status === 413 ? "That request is too large." : "Bad request.",
    });
});
app.listen(PORT, () => {
    console.log(`TestGen server running at http://localhost:${PORT}`);
});
