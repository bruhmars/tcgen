import fs from "node:fs";
import path from "node:path";
import { runMutation } from "./mutation";

const sourceFile = process.argv[2];
if (!sourceFile) {
  console.error("Usage: npx tsx src/mutate.ts samples/applyDiscount.ts");
  process.exit(1);
}

const testFile =
  process.argv[3] ?? path.join("generated", `${path.basename(sourceFile, ".ts")}.test.ts`);
if (!fs.existsSync(testFile)) {
  console.error(`No test file at ${testFile}. Generate tests first with src/cli.ts.`);
  process.exit(1);
}

console.log("Breaking your code in small ways and re-running the tests (about a minute)...");
const r = runMutation(sourceFile, testFile);

if (r.skipped) {
  console.log(`Skipped: ${r.skipped}`);
} else {
  console.log(`\nMutation score: ${Math.round(r.score)}% (${r.killed} of ${r.tried} changes were caught)`);
  if (r.survivors.length > 0) {
    console.log("\nChanges your tests did NOT notice:");
    for (const s of r.survivors) console.log(`  - ${s}`);
  }
}