// Fix missing .js extensions in TypeScript imports after ts-morph migration.
// ts-morph's file.move() drops .js extensions that NodeNext requires.
// Handles both import/export declarations AND inline import() type expressions.
//
// Usage: npx tsx scripts/migration/fix-extensions.ts

import { Project, SyntaxKind } from 'ts-morph';
import path from 'node:path';

const SERVER_ROOT = path.resolve(import.meta.dirname, '..', '..');

const project = new Project({
  tsConfigFilePath: path.join(SERVER_ROOT, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: false,
});

let fixCount = 0;
let inlineFixCount = 0;

for (const sourceFile of project.getSourceFiles()) {
  const filePath = sourceFile.getFilePath();
  if (filePath.includes('node_modules')) continue;

  // Fix import/export declarations
  const importDecls = sourceFile.getImportDeclarations();
  const exportDecls = sourceFile.getExportDeclarations();

  for (const decl of [...importDecls, ...exportDecls]) {
    const moduleSpecifier = decl.getModuleSpecifierValue();
    if (!moduleSpecifier) continue;
    if (!moduleSpecifier.startsWith('.')) continue;
    if (moduleSpecifier.endsWith('.js') || moduleSpecifier.endsWith('.json')) continue;

    decl.setModuleSpecifier(moduleSpecifier + '.js');
    fixCount++;
  }

  // Fix inline import() type expressions: import('../../path/to/module')
  // These appear as CallExpression with Import keyword
  const fullText = sourceFile.getFullText();
  const importRegex = /import\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  while ((match = importRegex.exec(fullText)) !== null) {
    const specifier = match[1];
    if (!specifier || !specifier.startsWith('.')) continue;
    if (specifier.endsWith('.js') || specifier.endsWith('.json')) continue;

    const quote = fullText[match.index + 'import('.length] === "'" ? "'" : '"';
    const oldImport = `import(${quote}${specifier}${quote})`;
    const newImport = `import(${quote}${specifier}.js${quote})`;
    replacements.push({
      start: match.index,
      end: match.index + oldImport.length,
      text: newImport,
    });
    inlineFixCount++;
  }

  // Apply replacements in reverse order to preserve positions
  if (replacements.length > 0) {
    let text = fullText;
    for (const r of replacements.reverse()) {
      text = text.slice(0, r.start) + r.text + text.slice(r.end);
    }
    sourceFile.replaceWithText(text);
  }
}

console.log(`Fixed ${fixCount} import/export specifiers`);
console.log(`Fixed ${inlineFixCount} inline import() expressions`);
const total = fixCount + inlineFixCount;
if (total > 0) {
  await project.save();
  console.log(`Saved ${total} fixes.`);
} else {
  console.log('No fixes needed.');
}
