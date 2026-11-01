import fs from "node:fs";
import path from "node:path";
import { Project, SyntaxKind } from "ts-morph";
import { runTests } from "./runner";

export interface MutationResult {
  skipped: string | null; // reason, if we couldn't measure
  tried: number;
  killed: number;
  survived: number;
  score: number;          // percent killed
  survivors: string[];    // which changes the tests did NOT notice
}

// The small "breakages" we try: swap an operator for a different one
const SWAPS: Record<string, string> = {
  "<": "<=", "<=": "<", ">": ">=", ">=": ">",
  "===": "!==", "!==": "===", "==": "!=", "!=": "==",
  "+": "-", "-": "+", "*": "/", "/": "*", "%": "*",
  "&&": "||", "||": "&&",
};

interface Mutant {
  description: string;
  code: string; // the full source code with ONE change
}

function createMutants(sourceFile: string): Mutant[] {
  const project = new Project();
  const file = project.addSourceFileAtPath(sourceFile);
  const text = file.getFullText();
  const mutants: Mutant[] = [];

  // Operators like <, >, ===, &&, +
  for (const node of file.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const token = node.getOperatorToken();
    const swap = SWAPS[token.getText()];
    if (!swap) continue;
    mutants.push({
      description: `line ${token.getStartLineNumber()}: "${token.getText()}" -> "${swap}"`,
      code: text.slice(0, token.getStart()) + swap + text.slice(token.getEnd()),
    });
  }

  // true <-> false
  for (const kind of [SyntaxKind.TrueKeyword, SyntaxKind.FalseKeyword]) {
    for (const node of file.getDescendantsOfKind(kind)) {
      const swap = kind === SyntaxKind.TrueKeyword ? "false" : "true";
      mutants.push({
        description: `line ${node.getStartLineNumber()}: ${node.getText()} -> ${swap}`,
        code: text.slice(0, node.getStart()) + swap + text.slice(node.getEnd()),
      });
    }
  }

  return mutants;
}

export function runMutation(
  sourceFile: string,
  testFile: string,
  maxMutants = 20,
  log: (message: string) => void = console.log
): MutationResult {
  const dir = "tmp-mutation";
  const skip = (reason: string): MutationResult => ({
    skipped: reason, tried: 0, killed: 0, survived: 0, score: 0, survivors: [],
  });

  try {
    // Work on copies, so your real files are never touched
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const subject = path.join(dir, "subject.ts");
    const copiedTest = path.join(dir, "subject.test.ts");

    fs.writeFileSync(subject, fs.readFileSync(sourceFile, "utf-8"));
    fs.writeFileSync(
      copiedTest,
      fs.readFileSync(testFile, "utf-8").replace(/from "(?!vitest")[^"]+"/, 'from "./subject"')
    );

    // The tests must all pass on the ORIGINAL code, or the score means nothing
    const baseline = runTests(copiedTest, subject, 30_000);
    if (baseline.crashed || baseline.total === 0 || baseline.failed > 0) {
      return skip("some tests already fail on the original code. Fix or remove them first.");
    }

    // Pick up to maxMutants changes, spread evenly through the code
    const all = createMutants(sourceFile);
    if (all.length === 0) return skip("nothing to mutate in this file.");
    const step = Math.max(1, all.length / maxMutants);
    const mutants =
      all.length <= maxMutants ? all : Array.from({ length: maxMutants }, (_, i) => all[Math.floor(i * step)]);

    let tried = 0;
    let killed = 0;
    const survivors: string[] = [];

    for (const [i, mutant] of mutants.entries()) {
      log(`  mutant ${i + 1}/${mutants.length}: ${mutant.description}`);
      fs.writeFileSync(subject, mutant.code);
      const r = runTests(copiedTest, subject, 20_000);

      const timedOut = r.crashed && r.crashMessage.startsWith("TIMEOUT");
      if (r.crashed && !timedOut) continue; // broken in a way that isn't a fair test, skip it

      tried++;
      if (timedOut || r.failed > 0) killed++;
      else survivors.push(mutant.description);
    }

    return {
      skipped: null,
      tried,
      killed,
      survived: tried - killed,
      score: tried > 0 ? (killed / tried) * 100 : 0,
      survivors,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}