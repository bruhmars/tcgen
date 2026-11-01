"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimitError = void 0;
exports.scanRepo = scanRepo;
exports.generateForRepo = generateForRepo;
const github_1 = require("./github");
const parser_1 = require("./parser");
const generator_1 = require("./generator");
const render_1 = require("./render");
class LimitError extends Error {
    constructor(message) {
        super(message);
        this.name = "LimitError";
    }
}
exports.LimitError = LimitError;
const IGNORE_PATTERNS = [
    /node_modules/i,
    /\/dist\//i,
    /\/build\//i,
    /\/coverage\//i,
    /\/out\//i,
    /\.min\.[tj]sx?$/i,
    /\.d\.ts$/i,
    /\.config\.[tj]sx?$/i,
    /test/i,
    /spec/i,
    /__tests__/i,
    /\/vendor\//i,
];
const VALID_EXTENSIONS = [".ts", ".js", ".mjs", ".tsx", ".jsx"];
async function scanRepo(ref) {
    const repoInfo = await (0, github_1.fetchGitHubJson)(`/repos/${ref.owner}/${ref.repo}`);
    const defaultBranch = repoInfo.default_branch || "main";
    let treeData;
    try {
        treeData = await (0, github_1.fetchGitHubJson)(`/repos/${ref.owner}/${ref.repo}/git/trees/${defaultBranch}?recursive=1`);
    }
    catch (err) {
        throw new github_1.RepoError(`Could not scan repository tree: ${err.message}`);
    }
    const rawTree = treeData.tree || [];
    const candidates = [];
    for (const item of rawTree) {
        if (item.type !== "blob" || !item.size)
            continue;
        const p = item.path;
        const hasValidExt = VALID_EXTENSIONS.some((ext) => p.endsWith(ext));
        if (!hasValidExt)
            continue;
        const isIgnored = IGNORE_PATTERNS.some((pat) => pat.test(p));
        if (isIgnored)
            continue;
        // Filter reasonable file sizes (100 bytes to 100 KB)
        if (item.size < 80 || item.size > 100_000)
            continue;
        candidates.push({ path: p, size: item.size });
    }
    // Sort candidate files by interesting paths (e.g. src/, lib/, utils/)
    candidates.sort((a, b) => {
        const scoreA = /^(src|lib|utils|app)/i.test(a.path) ? 1 : 0;
        const scoreB = /^(src|lib|utils|app)/i.test(b.path) ? 1 : 0;
        if (scoreA !== scoreB)
            return scoreB - scoreA;
        return a.path.localeCompare(b.path);
    });
    return {
        repo: `${ref.owner}/${ref.repo}`,
        description: repoInfo.description || "",
        totalCandidates: candidates.length,
        truncated: Boolean(treeData.truncated),
        candidates: candidates.slice(0, 50),
    };
}
async function generateForRepo(ref, paths, llm, takeDailySlot) {
    const files = [];
    const notes = [];
    let totalTests = 0;
    for (const filePath of paths) {
        let code;
        try {
            code = await (0, github_1.fetchGitHubRawFile)(ref.owner, ref.repo, filePath);
        }
        catch (err) {
            notes.push(`Could not fetch ${filePath}: ${err.message}`);
            continue;
        }
        let functions = [];
        try {
            functions = (0, parser_1.extractFunctionsFromText)(code);
        }
        catch {
            notes.push(`Could not parse AST for ${filePath}`);
            continue;
        }
        if (functions.length === 0) {
            notes.push(`No exported functions found in ${filePath}`);
            continue;
        }
        const usedFunctions = functions.slice(0, 3); // top 3 functions per file
        const cost = usedFunctions.length;
        if (takeDailySlot && !takeDailySlot(cost)) {
            throw new LimitError("Daily budget limit reached while processing repository.");
        }
        const results = [];
        for (const fn of usedFunctions) {
            try {
                const tests = await (0, generator_1.generateTests)(llm, fn);
                results.push({ fnName: fn.name, tests });
                totalTests += tests.length;
            }
            catch (err) {
                notes.push(`Failed to generate tests for ${fn.name} in ${filePath}: ${err.message}`);
            }
        }
        if (results.length > 0) {
            const testFileName = filePath.replace(/\.[tj]sx?$/, ".test.ts");
            const importPath = `./${filePath.replace(/\.[tj]sx?$/, "")}`;
            const testCode = (0, render_1.renderTestFile)(importPath, results);
            files.push({
                path: filePath,
                testPath: testFileName,
                testCode,
                testCount: results.reduce((acc, r) => acc + r.tests.length, 0),
            });
        }
    }
    return {
        files,
        testCount: totalTests,
        notes,
    };
}
