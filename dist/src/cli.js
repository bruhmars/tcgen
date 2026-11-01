"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const setup_1 = require("./setup");
const pipeline_1 = require("./pipeline");
async function main() {
    const args = process.argv.slice(2);
    const fresh = args.includes("--fresh"); // --fresh = ask the AI again instead of using saved answers
    const filePath = args.find((a) => !a.startsWith("--"));
    if (!filePath) {
        console.error("Please give a file. Example: npx tsx src/cli.ts samples/applyDiscount.ts");
        process.exit(1);
    }
    const llm = (0, setup_1.buildProvider)(fresh);
    const r = await (0, pipeline_1.runPipeline)(filePath, llm);
    console.log("\n===== RESULT =====");
    if (r.run.crashed) {
        console.log("The test file crashed:");
        console.log(r.run.crashMessage.slice(0, 600));
    }
    else {
        console.log(`Tests:    ${r.run.passed} passed, ${r.run.failed} failed (out of ${r.run.total})`);
        if (r.run.coverage) {
            const c = r.run.coverage;
            console.log(`Coverage: lines ${c.lines}%, branches ${c.branches}%, functions ${c.functions}%`);
        }
        for (const f of r.run.failures)
            console.log(`  FAILING: ${f.title}`);
    }
    if (r.repaired + r.flagged > 0) {
        console.log(`\n${r.repaired + r.flagged} test(s) were touched by the repair step.`);
        console.log(`Open ${r.testFile} and search for "!!" to review them by hand.`);
    }
    console.log(`Test file: ${r.testFile} (took ${r.seconds}s)`);
}
main().catch((err) => {
    console.error("Something went wrong:", err.message);
    process.exit(1);
});
