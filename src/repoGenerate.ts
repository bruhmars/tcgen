import type { LLMProvider } from "./llm";
import { RepoRef, RepoError, fetchGitHubJson, fetchGitHubRawFile } from "./github";
import { extractFunctionsFromText } from "./parser";
import { generateTestCode } from "./generator";

export class LimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitError";
  }
}

export interface CandidateFile {
  path: string;
  size: number;
}

export interface ScanResult {
  repo: string;
  description: string;
  totalCandidates: number;
  truncated: boolean;
  candidates: CandidateFile[];
}

export interface GeneratedFileResult {
  path: string;
  testPath: string;
  testCode: string;
  testCount: number;
}

export interface RepoGenerateResult {
  files: GeneratedFileResult[];
  testCount: number;
  notes: string[];
}

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

export async function scanRepo(ref: RepoRef): Promise<ScanResult> {
  const repoInfo = await fetchGitHubJson(`/repos/${ref.owner}/${ref.repo}`);
  const defaultBranch = repoInfo.default_branch || "main";

  let treeData: any;
  try {
    treeData = await fetchGitHubJson(
      `/repos/${ref.owner}/${ref.repo}/git/trees/${defaultBranch}?recursive=1`
    );
  } catch (err: any) {
    throw new RepoError(`Could not scan repository tree: ${err.message}`);
  }

  const rawTree: Array<{ path: string; type: string; size?: number }> = treeData.tree || [];
  const candidates: CandidateFile[] = [];

  for (const item of rawTree) {
    if (item.type !== "blob" || !item.size) continue;
    const p = item.path;

    const hasValidExt = VALID_EXTENSIONS.some((ext) => p.endsWith(ext));
    if (!hasValidExt) continue;

    const isIgnored = IGNORE_PATTERNS.some((pat) => pat.test(p));
    if (isIgnored) continue;

    // Filter reasonable file sizes (100 bytes to 100 KB)
    if (item.size < 80 || item.size > 100_000) continue;

    candidates.push({ path: p, size: item.size });
  }

  // Sort candidate files by interesting paths (e.g. src/, lib/, utils/)
  candidates.sort((a, b) => {
    const scoreA = /^(src|lib|utils|app)/i.test(a.path) ? 1 : 0;
    const scoreB = /^(src|lib|utils|app)/i.test(b.path) ? 1 : 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
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

export async function generateForRepo(
  ref: RepoRef,
  paths: string[],
  llm: LLMProvider,
  takeDailySlot?: (cost: number) => boolean
): Promise<RepoGenerateResult> {
  const files: GeneratedFileResult[] = [];
  const notes: string[] = [];
  let totalTests = 0;

  for (const filePath of paths) {
    let code: string;
    try {
      code = await fetchGitHubRawFile(ref.owner, ref.repo, filePath);
    } catch (err: any) {
      notes.push(`Could not fetch ${filePath}: ${err.message}`);
      continue;
    }

    let functions: any[] = [];
    try {
      functions = extractFunctionsFromText(code);
    } catch {
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

    const results: Array<{ fnName: string; code: string }> = [];
    for (const fn of usedFunctions) {
      try {
        const code = await generateTestCode(llm, fn);
        results.push({ fnName: fn.name, code });
        totalTests += (code.match(/\bit\s*\(/g) ?? []).length;
      } catch (err: any) {
        notes.push(`Failed to generate tests for ${fn.name} in ${filePath}: ${err.message}`);
      }
    }

    if (results.length > 0) {
      const testFileName = filePath.replace(/\.[tj]sx?$/, ".test.ts");
      const importPath = `./${filePath.replace(/\.[tj]sx?$/, "")}`;
      const fnNames = results.map((r) => r.fnName);
      const allCode = results.map((r) => r.code).join("\n");

      // Collect any extra vitest exports used (beforeEach, afterEach, etc.)
      const vitestNames = new Set(["describe", "it", "expect", "vi"]);
      for (const name of ["beforeEach", "afterEach", "beforeAll", "afterAll", "test"]) {
        if (new RegExp(`\\b${name}\\s*\\(`).test(allCode)) vitestNames.add(name);
      }
      const cleanBlocks = results.map((r) =>
        r.code.replace(/^import\s+[^;]+;\s*\n?/gm, "").trim()
      );
      const testCode =
        `import { ${[...vitestNames].join(", ")} } from "vitest";\n` +
        `import { ${fnNames.join(", ")} } from ${JSON.stringify(importPath)};\n\n` +
        cleanBlocks.join("\n\n") + "\n";

      files.push({
        path: filePath,
        testPath: testFileName,
        testCode,
        testCount: results.reduce((acc, r) => acc + (r.code.match(/\bit\s*\(/g) ?? []).length, 0),
      });
    }
  }

  return {
    files,
    testCount: totalTests,
    notes,
  };
}
