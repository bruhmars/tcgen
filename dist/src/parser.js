"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFunctions = extractFunctions;
exports.extractFunctionsFromText = extractFunctionsFromText;
const ts_morph_1 = require("ts-morph");
function docText(node) {
    return node
        .getJsDocs()
        .map((d) => d.getDescription().trim())
        .join("\n");
}
function describeFunction(name, fn, doc, source) {
    const ifChecks = fn
        .getDescendantsOfKind(ts_morph_1.SyntaxKind.IfStatement)
        .map((n) => n.getExpression().getText());
    const ternaries = fn
        .getDescendantsOfKind(ts_morph_1.SyntaxKind.ConditionalExpression)
        .map((n) => `${n.getCondition().getText()} (ternary)`);
    return {
        name,
        params: fn.getParameters().map((p) => ({
            name: p.getName(),
            type: p.getTypeNode()?.getText() ?? p.getType().getText(),
        })),
        returnType: fn.getReturnTypeNode()?.getText() ?? fn.getReturnType().getText(),
        doc,
        conditions: [...ifChecks, ...ternaries],
        throws: fn.getDescendantsOfKind(ts_morph_1.SyntaxKind.ThrowStatement).map((n) => n.getExpression().getText()),
        source,
    };
}
function collect(file, onlyExported) {
    const found = [];
    // function name() { ... }
    for (const fn of file.getFunctions()) {
        const name = fn.getName();
        if (!name || (onlyExported && !fn.isExported()))
            continue;
        found.push(describeFunction(name, fn, docText(fn), fn.getText()));
    }
    // const name = () => { ... }   or   const name = function () { ... }
    for (const statement of file.getVariableStatements()) {
        if (onlyExported && !statement.isExported())
            continue;
        for (const decl of statement.getDeclarations()) {
            const init = decl.getInitializer();
            if (init && (ts_morph_1.Node.isArrowFunction(init) || ts_morph_1.Node.isFunctionExpression(init))) {
                found.push(describeFunction(decl.getName(), init, docText(statement), statement.getText()));
            }
        }
    }
    return found;
}
// For the command line: reads a file from disk (only exported functions)
function extractFunctions(filePath) {
    const project = new ts_morph_1.Project();
    return collect(project.addSourceFileAtPath(filePath), true);
}
// For the website: reads pasted text (all functions, exported or not)
function extractFunctionsFromText(code) {
    const project = new ts_morph_1.Project({
        useInMemoryFileSystem: true, // nothing is written to disk
        skipLoadingLibFiles: true, // faster and lighter on a small free server
        skipFileDependencyResolution: true,
    });
    return collect(project.createSourceFile("input.ts", code), false);
}
