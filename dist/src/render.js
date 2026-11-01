"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTestFile = renderTestFile;
function renderTest(fnName, t) {
    const args = t.args.map((a) => JSON.stringify(a)).join(", ");
    const title = JSON.stringify(`[${t.category}] ${t.name}`);
    let check;
    if (t.shouldThrow) {
        check = `expect(() => ${fnName}(${args})).toThrow();`;
    }
    else if (typeof t.expected === "number" && !Number.isInteger(t.expected)) {
        check = `expect(${fnName}(${args})).toBeCloseTo(${JSON.stringify(t.expected)}, 5);`;
    }
    else {
        check = `expect(${fnName}(${args})).toEqual(${JSON.stringify(t.expected)});`;
    }
    const noteLine = t.note ? `  // !! ${t.note.replace(/\s+/g, " ")}\n` : "";
    const reasonLine = `  // ${t.reason.replace(/\s+/g, " ")}\n`;
    return `${noteLine}${reasonLine}  it(${title}, () => {\n    ${check}\n  });`;
}
function renderTestFile(importPath, results) {
    const names = results.map((r) => r.fnName).join(", ");
    const blocks = results.map((r) => `describe(${JSON.stringify(r.fnName)}, () => {\n` +
        r.tests.map((t) => renderTest(r.fnName, t)).join("\n\n") +
        `\n});`);
    return (`import { describe, it, expect } from "vitest";\n` +
        `import { ${names} } from ${JSON.stringify(importPath)};\n\n` +
        blocks.join("\n\n") +
        "\n");
}
