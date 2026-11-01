import { Project, SyntaxKind, Node } from "ts-morph";
import type { SourceFile, FunctionDeclaration, ArrowFunction, FunctionExpression } from "ts-morph";

export interface FunctionInfo {
  name: string;
  params: { name: string; type: string }[];
  returnType: string;
  doc: string;          // the comment above the function, if any
  conditions: string[]; // every "if (...)" check and ternary
  throws: string[];     // every "throw ..." line
  source: string;       // the function's full code
}

type Callable = FunctionDeclaration | ArrowFunction | FunctionExpression;

function docText(node: { getJsDocs(): { getDescription(): string }[] }): string {
  return node
    .getJsDocs()
    .map((d) => d.getDescription().trim())
    .join("\n");
}

function describeFunction(name: string, fn: Callable, doc: string, source: string): FunctionInfo {
  const ifChecks = fn
    .getDescendantsOfKind(SyntaxKind.IfStatement)
    .map((n) => n.getExpression().getText());
  const ternaries = fn
    .getDescendantsOfKind(SyntaxKind.ConditionalExpression)
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
    throws: fn.getDescendantsOfKind(SyntaxKind.ThrowStatement).map((n) => n.getExpression().getText()),
    source,
  };
}

function collect(file: SourceFile, onlyExported: boolean): FunctionInfo[] {
  const found: FunctionInfo[] = [];

  // function name() { ... }
  for (const fn of file.getFunctions()) {
    const name = fn.getName();
    if (!name || (onlyExported && !fn.isExported())) continue;
    found.push(describeFunction(name, fn, docText(fn), fn.getText()));
  }

  // const name = () => { ... }   or   const name = function () { ... }
  for (const statement of file.getVariableStatements()) {
    if (onlyExported && !statement.isExported()) continue;
    for (const decl of statement.getDeclarations()) {
      const init = decl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        found.push(describeFunction(decl.getName(), init, docText(statement), statement.getText()));
      }
    }
  }

  return found;
}

// For the command line: reads a file from disk (only exported functions)
export function extractFunctions(filePath: string): FunctionInfo[] {
  const project = new Project();
  return collect(project.addSourceFileAtPath(filePath), true);
}

// For the website: reads pasted text (all functions, exported or not)
export function extractFunctionsFromText(code: string): FunctionInfo[] {
  const project = new Project({
    useInMemoryFileSystem: true,      // nothing is written to disk
    skipLoadingLibFiles: true,        // faster and lighter on a small free server
    skipFileDependencyResolution: true,
  });
  return collect(project.createSourceFile("input.ts", code), false);
}