import "dotenv/config";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { buildProvider } from "./setup";
import { generateFromCode, UserError } from "./generateFromCode";
import { parseRepoUrl, RepoError } from "./github";
import { scanRepo, generateForRepo, LimitError } from "./repoGenerate";
import { generateApiTestPlan } from "./apiTestGenerator";
import { generateRequirementTestPlan } from "./requirementTestGenerator";
import { generateApiTestExcel, generateRequirementTestExcel } from "./excelService";
import {
  exportApiTestsToCsv,
  exportApiTestsToMarkdown,
  exportRequirementTestsToCsv,
  exportRequirementTestsToMarkdown,
  exportToMindMapJson,
} from "./exportService";

const PORT = Number(process.env.PORT) || 3000;
const MAX_CHARS = 12000;
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT) || 300;
const MAX_CONCURRENT = 3;

const llm = buildProvider(false);

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "upgrade-insecure-requests": null,
      },
    },
  })
);
app.use(express.json({ limit: "500kb" }));
app.use(express.static(path.join(process.cwd(), "public")));

// ----- limits -----
function hourlyLimit(limit: number, message: string) {
  return rateLimit({
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
function takeDailySlot(cost: number): boolean {
  const now = new Date().toISOString().slice(0, 10);
  if (now !== today) {
    today = now;
    usedToday = 0;
  }
  if (usedToday + cost > DAILY_LIMIT) return false;
  usedToday += cost;
  return true;
}

let running = 0;

function sendError(res: any, err: any) {
  if (err instanceof RepoError || err instanceof UserError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof LimitError) {
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
  if (!code) return res.status(400).json({ error: "Paste some code first." });
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
    res.json(await generateFromCode(code, llm));
  } catch (err) {
    sendError(res, err);
  } finally {
    running--;
  }
});

// 2. Repo mode: scan repository
app.post("/api/repo/scan", scanLimiter, async (req, res) => {
  try {
    const ref = parseRepoUrl(String(req.body?.url ?? ""));
    res.json(await scanRepo(ref));
  } catch (err) {
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
    const ref = parseRepoUrl(String(req.body?.url ?? ""));
    const paths = Array.isArray(req.body?.paths)
      ? req.body.paths.filter((p: unknown) => typeof p === "string").slice(0, 10)
      : [];
    if (paths.length === 0) return res.status(400).json({ error: "Pick at least one file." });

    res.json(await generateForRepo(ref, paths, llm, takeDailySlot));
  } catch (err) {
    sendError(res, err);
  } finally {
    running--;
  }
});

// 4. API endpoint test generation (from Mallikarjun repo pattern)
app.post("/api/api-tests", apiLimiter, async (req, res) => {
  const endpoint = String(req.body?.endpoint || "").trim();
  if (!endpoint) return res.status(400).json({ error: "Endpoint route is required." });
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
    const plan = await generateApiTestPlan(llm, { endpoint, method, payload, extraContext });
    res.json(plan);
  } catch (err) {
    sendError(res, err);
  } finally {
    running--;
  }
});

// 5. Requirement / PRD test plan generation (from EmptyRabbit & Rajesh repo patterns)
app.post("/api/requirement-tests", reqLimiter, async (req, res) => {
  const requirementText = String(req.body?.requirementText || "").trim();
  if (!requirementText) return res.status(400).json({ error: "Requirement text or specification is required." });
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
    const plan = await generateRequirementTestPlan(llm, { requirementText, title, moduleFilter });
    res.json(plan);
  } catch (err) {
    sendError(res, err);
  } finally {
    running--;
  }
});

// 6. Direct Export Endpoints: Excel (.xlsx), CSV, Markdown
app.post("/api/export/excel", async (req, res) => {
  try {
    const type = req.body?.type; // "api" | "requirement"
    const data = req.body?.data;
    if (!data) return res.status(400).json({ error: "Data is required for export." });

    if (type === "api") {
      const { buffer, filename } = await generateApiTestExcel(
        data.endpoint || "/api",
        data.method || "GET",
        data.testCases || []
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } else {
      const { buffer, filename } = await generateRequirementTestExcel(
        data.title || "Requirements",
        data.traceabilityMatrix || [],
        data.testCases || []
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    }
  } catch (err: any) {
    sendError(res, err);
  }
});

app.post("/api/export/csv", (req, res) => {
  try {
    const type = req.body?.type;
    const data = req.body?.data;
    if (!data) return res.status(400).json({ error: "Data is required." });

    if (type === "api") {
      const csv = exportApiTestsToCsv(data.testCases || []);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="api_tests_${Date.now()}.csv"`);
      return res.send(csv);
    } else {
      const csv = exportRequirementTestsToCsv(data.testCases || []);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="requirement_tests_${Date.now()}.csv"`);
      return res.send(csv);
    }
  } catch (err: any) {
    sendError(res, err);
  }
});

app.post("/api/export/markdown", (req, res) => {
  try {
    const type = req.body?.type;
    const data = req.body?.data;
    if (!data) return res.status(400).json({ error: "Data is required." });

    if (type === "api") {
      const md = exportApiTestsToMarkdown(data.endpoint || "/", data.method || "GET", data.testCases || []);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="api_tests_${Date.now()}.md"`);
      return res.send(md);
    } else {
      const md = exportRequirementTestsToMarkdown(
        data.title || "Requirements",
        data.traceabilityMatrix || [],
        data.testCases || []
      );
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="requirement_tests_${Date.now()}.md"`);
      return res.send(md);
    }
  } catch (err: any) {
    sendError(res, err);
  }
});

// Error handling middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.status === 413 ? 413 : 400).json({
    error: err?.status === 413 ? "That request is too large." : "Bad request.",
  });
});

app.listen(PORT, () => {
  console.log(`TestGen server running at http://localhost:${PORT}`);
});
