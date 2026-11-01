import fs from "node:fs";
import path from "node:path";
import { buildProvider } from "./setup";
import { runPipeline } from "./pipeline";
import { runMutation } from "./mutation";

interface Row {
  file: string;
  ranOk: boolean;
  firstPassed: number;
  firstTotal: number;
  passed: number;
  total: number;
  repaired: number;
  flagged: number;
  lines: number | null;
  branches: number | null;
  mutation: number | null;
  seconds: number;
}

const pct = (n: number | null) => (n === null ? "-" : `${Math.round(n)}%`);
const ratio = (a: number, b: number) => (b === 0 ? null : (100 * a) / b);
const sum = (rows: Row[], pick: (r: Row) => number) => rows.reduce((t, r) => t + pick(r), 0);
const average = (values: number[]) =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
const numbers = (values: (number | null)[]) => values.filter((v): v is number => v !== null);

async function main() {
  const args = process.argv.slice(2);
  const fresh = args.includes("--fresh");
  const withMutation = args.includes("--mutation");
  const dir = args.find((a) => !a.startsWith("--")) ?? "benchmark";

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .map((f) => path.join(dir, f));
  if (files.length === 0) {
    console.error(`No .ts files found in ${dir}`);
    process.exit(1);
  }

  const llm = buildProvider(fresh);
  const rows: Row[] = [];

  for (const [i, file] of files.entries()) {
    console.log(`\n[${i + 1}/${files.length}] ${file}`);
    try {
      const r = await runPipeline(file, llm, {
        outputDir: path.join("generated", dir),
        log: () => {}, // quiet
      });

      let mutation: number | null = null;
      if (withMutation && !r.run.crashed) {
        const m = runMutation(file, r.testFile, 20, () => {});
        if (m.skipped) console.log(`  mutation skipped: ${m.skipped}`);
        else mutation = m.score;
      }

      rows.push({
        file,
        ranOk: !r.run.crashed && r.run.total > 0,
        firstPassed: r.firstRun.passed,
        firstTotal: r.firstRun.total,
        passed: r.run.passed,
        total: r.run.total,
        repaired: r.repaired,
        flagged: 0,
        lines: r.run.coverage?.lines ?? null,
        branches: r.run.coverage?.branches ?? null,
        mutation,
        seconds: r.seconds,
      });
      console.log(`  ${r.run.passed}/${r.run.total} tests pass`);
    } catch (err: any) {
      console.log(`  failed: ${err.message}`);
      rows.push({
        file, ranOk: false, firstPassed: 0, firstTotal: 0, passed: 0, total: 0,
        repaired: 0, flagged: 0, lines: null, branches: null, mutation: null, seconds: 0,
      });
    }
  }

  // Build the table
  const header = [
    "File", "Ran", "Pass before repair", "Pass after repair", "Repaired", "Flagged",
    "Lines", "Branches", ...(withMutation ? ["Mutation"] : []), "Time",
  ];
  const table: string[] = [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`];
  for (const r of rows) {
    const cells = [
      path.basename(r.file),
      r.ranOk ? "yes" : "NO",
      `${r.firstPassed}/${r.firstTotal}`,
      `${r.passed}/${r.total}`,
      String(r.repaired),
      String(r.flagged),
      pct(r.lines),
      pct(r.branches),
      ...(withMutation ? [pct(r.mutation)] : []),
      `${r.seconds}s`,
    ];
    table.push(`| ${cells.join(" | ")} |`);
  }

  const ran = rows.filter((r) => r.ranOk).length;
  const summary = [
    `- Files where the tests ran without crashing: ${ran}/${rows.length} (${pct(ratio(ran, rows.length))})`,
    `- Tests passing before repair: ${sum(rows, (r) => r.firstPassed)}/${sum(rows, (r) => r.firstTotal)} (${pct(ratio(sum(rows, (r) => r.firstPassed), sum(rows, (r) => r.firstTotal)))})`,
    `- Tests passing after repair: ${sum(rows, (r) => r.passed)}/${sum(rows, (r) => r.total)} (${pct(ratio(sum(rows, (r) => r.passed), sum(rows, (r) => r.total)))})`,
    `- Average line coverage: ${pct(average(numbers(rows.map((r) => r.lines))))}`,
    `- Average branch coverage: ${pct(average(numbers(rows.map((r) => r.branches))))}`,
    ...(withMutation ? [`- Average mutation score: ${pct(average(numbers(rows.map((r) => r.mutation))))}`] : []),
  ];

  const date = new Date().toISOString().slice(0, 10);
  const report = `# Benchmark results (${date})\n\n${table.join("\n")}\n\n${summary.join("\n")}\n`;
  fs.mkdirSync("results", { recursive: true });
  const reportPath = path.join("results", `benchmark-${date}.md`);
  fs.writeFileSync(reportPath, report);

  console.log("\n" + report);
  console.log(`Saved to ${reportPath}`);
}

main().catch((err) => {
  console.error("Something went wrong:", err.message);
  process.exit(1);
});