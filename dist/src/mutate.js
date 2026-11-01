"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const mutation_1 = require("./mutation");
const sourceFile = process.argv[2];
if (!sourceFile) {
    console.error("Usage: npx tsx src/mutate.ts samples/applyDiscount.ts");
    process.exit(1);
}
const testFile = process.argv[3] ?? node_path_1.default.join("generated", `${node_path_1.default.basename(sourceFile, ".ts")}.test.ts`);
if (!node_fs_1.default.existsSync(testFile)) {
    console.error(`No test file at ${testFile}. Generate tests first with src/cli.ts.`);
    process.exit(1);
}
console.log("Breaking your code in small ways and re-running the tests (about a minute)...");
const r = (0, mutation_1.runMutation)(sourceFile, testFile);
if (r.skipped) {
    console.log(`Skipped: ${r.skipped}`);
}
else {
    console.log(`\nMutation score: ${Math.round(r.score)}% (${r.killed} of ${r.tried} changes were caught)`);
    if (r.survivors.length > 0) {
        console.log("\nChanges your tests did NOT notice:");
        for (const s of r.survivors)
            console.log(`  - ${s}`);
    }
}
