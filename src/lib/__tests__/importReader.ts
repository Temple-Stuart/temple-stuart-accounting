/**
 * THE IMPORT READER — every module a file's code names, as TypeScript's own parser reads it, and the closure of a set of files. Written for
 * homePages01.test.ts (HOME-PAGES-01, 2026-11-14); moved here by HOME-MENU-01 (2026-11-16), whose homeMenu01.test.ts reads the top bar's imports
 * the same way, so the two tests share one reader and cannot drift (CLAUDE.md: reuse over rebuild). homePages01.test.ts T7 holds the shapes it
 * reads. Not a test file: npm test runs src/lib/__tests__/*.test.ts, and this is imported by two of them.
 */
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { code } from '../sourceText';

const ROOT = process.cwd();

/** The file an import names, when it is one of this repo's under src — null for a package. A path that names no file fails by name. */
export function fileOf(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join('src', spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (base === null) return null;
  const found = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].filter((f) => existsSync(resolve(ROOT, f)) && statSync(resolve(ROOT, f)).isFile());
  assert.equal(found.length, 1, `${from}: "${spec}" names one file under src (found ${JSON.stringify(found)})`);
  return found[0];
}
/**
 * Every module a file's code names, as TypeScript's own PARSER reads the file (ts.createSourceFile): each import declaration and each
 * `export … from` — a namespace re-export too — wherever it stands on a line (this repo writes a second import on a line: Landing.tsx's
 * StopZeroSection), import-equals, an import type, each import() call, and each call of require or of a property named require. Text inside
 * a string, a template literal, a regex literal or JSX text is not an import (the tool registry's citations hold a `from "…"`). Such a call
 * that names its module by anything but a literal names none this reader can follow: it is returned as NOT_A_LITERAL, and the closed list of
 * packages then refuses it by name. NOT READ: a require reached under another name (`const r = require; r('x')`), which only a deliberate edit
 * writes. T7 holds the shapes. (Until the second review of HOME-PAGES-01, 2026-11-14, this was four patterns of the test's own, which read a
 * statement only where it started a line; then, until the third review, TypeScript's scanner ts.preProcessFile, which did not read
 * `export * as ns from`.)
 */
export const NOT_A_LITERAL = '(a module named by something that is not a literal)';
export function specsOf(src: string, file: string): string[] {
  const tree = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, false, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const specs: string[] = [];
  const named = (node: ts.Node | undefined): void => {
    if (node !== undefined) specs.push(ts.isStringLiteralLike(node) ? node.text : NOT_A_LITERAL);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) named(node.moduleSpecifier);
    else if (ts.isExportDeclaration(node)) named(node.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) named(node.moduleReference.expression);
    else if (ts.isImportTypeNode(node)) named(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument);
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require') || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'require'))) named(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return specs;
}
/** Everything a set of files imports, and what those import, to the end: the files under src, and the packages they reach outside it. */
export function closureOf(entries: readonly string[]): { files: string[]; packages: string[] } {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specsOf(code(file), file)) {
      const next = fileOf(file, spec);
      if (next === null) packages.add(spec);
      else queue.push(next);
    }
  }
  return { files: [...seen].sort(), packages: [...packages].sort() };
}
