"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMutation = runMutation;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const ts_morph_1 = require("ts-morph");
const runner_1 = require("./runner");
// The small "breakages" we try: swap an operator for a different one
const SWAPS = {
    "<": "<=", "<=": "<", ">": ">=", ">=": ">",
    "===": "!==", "!==": "===", "==": "!=", "!=": "==",
    "+": "-", "-": "+", "*": "/", "/": "*", "%": "*",
    "&&": "||", "||": "&&",
};
function createMutants(sourceFile) {
    const project = new ts_morph_1.Project();
    const file = project.addSourceFileAtPath(sourceFile);
    const text = file.getFullText();
    const mutants = [];
    // Operators like <, >, ===, &&, +
    for (const node of file.getDescendantsOfKind(ts_morph_1.SyntaxKind.BinaryExpression)) {
        const token = node.getOperatorToken();
        const swap = SWAPS[token.getText()];
        if (!swap)
            continue;
        mutants.push({
            description: `line ${token.getStartLineNumber()}: "${token.getText()}" -> "${swap}"`,
            code: text.slice(0, token.getStart()) + swap + text.slice(token.getEnd()),
        });
    }
    // true <-> false
    for (const kind of [ts_morph_1.SyntaxKind.TrueKeyword, ts_morph_1.SyntaxKind.FalseKeyword]) {
        for (const node of file.getDescendantsOfKind(kind)) {
            const swap = kind === ts_morph_1.SyntaxKind.TrueKeyword ? "false" : "true";
            mutants.push({
                description: `line ${node.getStartLineNumber()}: ${node.getText()} -> ${swap}`,
                code: text.slice(0, node.getStart()) + swap + text.slice(node.getEnd()),
            });
        }
    }
    return mutants;
}
function runMutation(sourceFile, testFile, maxMutants = 20, log = console.log) {
    const dir = "tmp-mutation";
    const skip = (reason) => ({
        skipped: reason, tried: 0, killed: 0, survived: 0, score: 0, survivors: [],
    });
    try {
        // Work on copies, so your real files are never touched
        node_fs_1.default.rmSync(dir, { recursive: true, force: true });
        node_fs_1.default.mkdirSync(dir, { recursive: true });
        const subject = node_path_1.default.join(dir, "subject.ts");
        const copiedTest = node_path_1.default.join(dir, "subject.test.ts");
        node_fs_1.default.writeFileSync(subject, node_fs_1.default.readFileSync(sourceFile, "utf-8"));
        node_fs_1.default.writeFileSync(copiedTest, node_fs_1.default.readFileSync(testFile, "utf-8").replace(/from "(?!vitest")[^"]+"/, 'from "./subject"'));
        // The tests must all pass on the ORIGINAL code, or the score means nothing
        const baseline = (0, runner_1.runTests)(copiedTest, subject, 30_000);
        if (baseline.crashed || baseline.total === 0 || baseline.failed > 0) {
            return skip("some tests already fail on the original code. Fix or remove them first.");
        }
        // Pick up to maxMutants changes, spread evenly through the code
        const all = createMutants(sourceFile);
        if (all.length === 0)
            return skip("nothing to mutate in this file.");
        const step = Math.max(1, all.length / maxMutants);
        const mutants = all.length <= maxMutants ? all : Array.from({ length: maxMutants }, (_, i) => all[Math.floor(i * step)]);
        let tried = 0;
        let killed = 0;
        const survivors = [];
        for (const [i, mutant] of mutants.entries()) {
            log(`  mutant ${i + 1}/${mutants.length}: ${mutant.description}`);
            node_fs_1.default.writeFileSync(subject, mutant.code);
            const r = (0, runner_1.runTests)(copiedTest, subject, 20_000);
            const timedOut = r.crashed && r.crashMessage.startsWith("TIMEOUT");
            if (r.crashed && !timedOut)
                continue; // broken in a way that isn't a fair test, skip it
            tried++;
            if (timedOut || r.failed > 0)
                killed++;
            else
                survivors.push(mutant.description);
        }
        return {
            skipped: null,
            tried,
            killed,
            survived: tried - killed,
            score: tried > 0 ? (killed / tried) * 100 : 0,
            survivors,
        };
    }
    finally {
        node_fs_1.default.rmSync(dir, { recursive: true, force: true });
    }
}
