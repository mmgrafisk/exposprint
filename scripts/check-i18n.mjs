import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const roots = ["app", "components"];
const visibleAttributes = new Set(["alt", "aria-label", "placeholder", "title"]);
const failures = [];

async function filesBelow(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = join(path, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

function hasWords(value) {
  return /\p{L}{2,}/u.test(value.trim());
}

for (const root of roots) {
  for (const file of await filesBelow(root)) {
    if (![".tsx", ".jsx"].includes(extname(file))) continue;
    const sourceText = await readFile(file, "utf8");
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isJsxText(node) && hasWords(node.getText(source))) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        failures.push(`${relative(".", file)}:${position.line + 1} visible JSX text: ${node.getText(source).trim()}`);
      }
      if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer) && hasWords(node.initializer.text)) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        failures.push(`${relative(".", file)}:${position.line + 1} hardcoded ${node.name.getText(source)}: ${node.initializer.text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("No hardcoded visible JSX text found.");
}
