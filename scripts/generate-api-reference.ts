#!/usr/bin/env ts-node

/**
 * API Docs Autogenerator
 * Smart Generics + JSDoc + Class APIs + Fumadocs MDX output
 *
 * Output: apps/web/content/api-reference/*.mdx
 * No nested dirs — 1 doc per package
 */

import path from "node:path";
import fs from "node:fs";
import ts from "typescript";

const packagesDir = path.resolve("packages");
const outputDir = path.resolve("apps/web/content/docs/api-reference");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

const isInternal = (symbol: ts.Symbol) =>
  symbol
    .getJsDocTags()
    .some((tag) => tag.name === "internal" || tag.name === "private");

/** Convert file/path names -> Pretty heading */
const toHeading = (s: string) =>
  s
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

/** Extract first line of JSDoc if exists */
function getDoc(symbol: ts.Symbol, checker: ts.TypeChecker): string | null {
  const docs = symbol.getDocumentationComment(checker);
  if (!docs.length) return null;
  return ts.displayPartsToString(docs).split("\n")[0]!.trim();
}

/** Extract @tag docs like @param, @returns, @throws */
function getTags(symbol: ts.Symbol): Record<string, string[]> {
  const tags = symbol.getJsDocTags();
  return tags.reduce<Record<string, string[]>>((acc, tag) => {
    if (!acc[tag.name]) acc[tag.name] = [];
    if (tag.text) {
      acc[tag.name]!.push(tag.text.map((t) => t.text).join(""));
    }
    return acc;
  }, {});
}

/** Transform signature -> param list */
function getParams(signature: ts.Signature, checker: ts.TypeChecker) {
  return signature.getParameters().map((p) => {
    const type = checker.getTypeOfSymbolAtLocation(
      p,
      p.valueDeclaration || p.declarations?.[0]!
    );
    return {
      name: p.getName(),
      type: checker.typeToString(type),
    };
  });
}

/** Generate a placeholder value for a parameter based on its type */
function generatePlaceholder(paramType: string): string {
  // Handle function types
  if (paramType.includes("=>") || paramType.startsWith("(")) {
    return "() => {}";
  }
  // Handle string types
  if (paramType.includes("string")) {
    return '""';
  }
  // Handle number types
  if (paramType.includes("number")) {
    return "0";
  }
  // Handle boolean types
  if (paramType.includes("boolean")) {
    return "false";
  }
  // Handle array types
  if (paramType.includes("[]")) {
    return "[]";
  }
  // Handle object/record types
  if (paramType.includes("{") || paramType.startsWith("Record<")) {
    return "{}";
  }
  // Default to undefined for complex types
  return "undefined as any";
}

function generateUsageExample(
  name: string,
  pkgName: string,
  genericCount: number,
  constructorParams: { name: string; type: string }[]
) {
  const generic =
    genericCount > 0
      ? `<${Array(genericCount).fill("unknown").join(", ")}>`
      : "";
  const args = constructorParams
    .map((p) => generatePlaceholder(p.type))
    .join(", ");
  const code = `import { ${name} } from "@open-ot/${pkgName}";
// ---cut---
const instance = new ${name}${generic}(${args});
//                      ^?`;
  return `
\`\`\`ts twoslash
${code}
\`\`\`
`;
}

/** Build MDX for a class */
function renderClassAPI(
  name: string,
  classSymbol: ts.Symbol,
  checker: ts.TypeChecker,
  pkgName: string
) {
  let mdx = `# ${name}\n\n`;
  const doc = getDoc(classSymbol, checker);
  if (doc) mdx += `${doc}\n\n`;

  const instanceType = checker.getDeclaredTypeOfSymbol(classSymbol);

  // Get the type of the class symbol itself (the constructor function)
  const classType = checker.getTypeOfSymbolAtLocation(
    classSymbol,
    classSymbol.valueDeclaration || classSymbol.declarations?.[0]!
  );
  const constructorSig = classType.getConstructSignatures().slice(-1)[0]; // last defined signature
  const classDecl = (classSymbol.valueDeclaration ||
    classSymbol.declarations?.[0]) as ts.ClassDeclaration | undefined;

  const tags = getTags(classSymbol);

  // Get constructor params for use in all examples
  const constructorParams = constructorSig
    ? getParams(constructorSig, checker)
    : [];

  if (constructorSig) {
    mdx += `### Constructor\n\n`;

    // Determine number of generic parameters on the class declaration (preferred),
    // falling back to constructor signature type parameters if necessary.
    let genericCount = 0;
    if (
      classDecl &&
      ts.isClassDeclaration(classDecl) &&
      classDecl.typeParameters
    ) {
      genericCount = classDecl.typeParameters.length;
    } else if (constructorSig && constructorSig.getTypeParameters) {
      genericCount = constructorSig.getTypeParameters()?.length ?? 0;
    }

    const example = generateUsageExample(
      name,
      pkgName,
      genericCount,
      constructorParams
    );
    mdx += example;

    const params = getParams(constructorSig, checker);
    if (params.length) {
      mdx += `**Parameters:**\n`;
      for (const p of params) {
        mdx += `- \`${p.name}: ${p.type}\`\n`;
      }
      mdx += `\n`;
    }
  }

  mdx += `### Methods\n\n`;

  // Determine class generic count for usage in method examples
  let globalGenericCount = 0;
  if (
    classDecl &&
    ts.isClassDeclaration(classDecl) &&
    classDecl.typeParameters
  ) {
    globalGenericCount = classDecl.typeParameters.length;
  } else if (constructorSig && constructorSig.getTypeParameters) {
    globalGenericCount = constructorSig.getTypeParameters()?.length ?? 0;
  }

  const methods = instanceType.getProperties().filter((prop) => {
    if (isInternal(prop)) return false;
    const decl = prop.valueDeclaration || prop.declarations?.[0];
    if (!decl) return false;
    // Skip if marked private/protected in TS modifiers
    const mods = (decl as any).modifiers;
    if (
      mods &&
      mods.some(
        (m: any) =>
          m.kind === ts.SyntaxKind.PrivateKeyword ||
          m.kind === ts.SyntaxKind.ProtectedKeyword
      )
    )
      return false;
    return decl && (ts.isMethodSignature(decl) || ts.isMethodDeclaration(decl));
  });

  for (const method of methods) {
    const decl = method.valueDeclaration || method.declarations?.[0];
    if (!decl) continue;

    const signatures = checker
      .getTypeOfSymbolAtLocation(method, decl)
      .getCallSignatures();

    if (!signatures.length) continue;

    const sig = signatures[0];
    if (!sig) continue;

    const methodTags = getTags(method);
    const summary = getDoc(method, checker);
    const returnType = checker.getReturnTypeOfSignature(sig);

    mdx += `#### \`${method.getName()}(${getParams(sig, checker)
      .map((p) => p.name)
      .join(", ")})\`\n\n`;
    if (summary) mdx += `${summary}\n\n`;

    mdx += "```ts twoslash\n";
    mdx += `import { ${name} } from "@open-ot/${pkgName}";\n`;
    mdx += `// ---cut---\n`;

    // Use constructor params when creating instance
    const constructorArgs = constructorParams
      .map((p) => generatePlaceholder(p.type))
      .join(", ");
    const generic =
      globalGenericCount > 0
        ? `<${Array(globalGenericCount).fill("unknown").join(", ")}>`
        : "";
    mdx += `const api = new ${name}${generic}(${constructorArgs});\n`;

    // Generate placeholder arguments for the method call
    const params = getParams(sig, checker);
    const args = params.map((p) => generatePlaceholder(p.type)).join(", ");

    mdx += `api.${method.getName()}(${args});\n// ^?\n`;
    mdx += "```\n\n";

    const methodParams = getParams(sig, checker);
    if (methodParams.length) {
      mdx += `**Parameters:**\n`;
      for (const p of methodParams) {
        mdx += `- \`${p.name}: ${p.type}\`\n`;
      }
      mdx += `\n`;
    }

    const returnString = checker.typeToString(returnType);
    if (returnString && returnString !== "void") {
      mdx += `**Returns:** \`${returnString}\`\n\n`;
    }

    if (methodTags.throws) {
      mdx += `**Throws:**\n`;
      for (const t of methodTags.throws) mdx += `- ${t}\n`;
      mdx += `\n`;
    }
  }

  return mdx;
}

/** Process a package */
function processPackage(pkgDir: string) {
  const src = path.resolve(pkgDir, "src/index.ts");
  if (!fs.existsSync(src)) return;

  // Collect all TS/TSX source files under the package to ensure re-exports are resolved
  function collectSourceFiles(dir: string) {
    const files: string[] = [];
    function walk(d: string) {
      for (const entry of fs.readdirSync(d)) {
        const full = path.join(d, entry);
        const stat = fs.lstatSync(full);
        if (stat.isDirectory()) walk(full);
        else if (
          stat.isFile() &&
          /\.tsx?$/.test(full) &&
          !full.endsWith(".d.ts")
        )
          files.push(full);
      }
    }
    walk(path.join(pkgDir, "src"));
    return files;
  }

  const rootFiles = collectSourceFiles(pkgDir);
  const pkgName = path.basename(pkgDir);
  if (!rootFiles.length) return;

  const program = ts.createProgram(rootFiles, {
    target: ts.ScriptTarget.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowJs: false,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(src);
  if (!sourceFile) return;
  const debug = process.env.DEBUG_AUTOGEN === "1";
  // Debug: list the files included in the program
  if (
    debug &&
    (pkgName === "core" || pkgName === "client" || pkgName === "server")
  ) {
    if (debug)
      console.log(
        `Debug ${pkgName}: program includes ${program.getSourceFiles().length} files`
      );
    if (debug)
      console.log(
        `Debug ${pkgName}: program files:", program.getSourceFiles().map(f => f.fileName).slice(0, 20)`
      );
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)!;
  const exports = checker.getExportsOfModule(moduleSymbol);
  // Debug the module symbol internals for troubleshooting
  if (pkgName === "client" || pkgName === "core" || pkgName === "server") {
    const exportsTable = (moduleSymbol as any).exports;
    const exportedKeys: string[] = [];
    if (exportsTable && typeof exportsTable.forEach === "function") {
      exportsTable.forEach((sym: any, name: string) => exportedKeys.push(name));
    }
    if (debug)
      console.log(
        `Debug ${pkgName}: moduleSymbol.exports size:`,
        exportsTable?.size ?? 0
      );
    if (debug)
      console.log(`Debug ${pkgName}: moduleSymbol.exports keys:`, exportedKeys);
  }
  const title = `${toHeading(pkgName)} API`;
  const description = `Autogenerated API reference for the \`@open-ot/${pkgName}\` package.`;

  let output = `---
title: ${title}
description: ${description}
---

`;

  const seen = new Set<string>();

  // Debug collected files for problematic packages
  if (pkgName === "core" || pkgName === "client" || pkgName === "server") {
    if (debug)
      console.log(
        `Debug ${pkgName}: collected ${rootFiles.length} source files`
      );
    if (debug)
      console.log(`Debug ${pkgName}: ${JSON.stringify(rootFiles, null, 2)}`);
    if (debug)
      console.log(
        `Debug ${pkgName}: program includes ${program.getSourceFiles().length} files`
      );
    if (debug)
      console.log(
        `Debug ${pkgName}: program files:", program.getSourceFiles().map(f => f.fileName).slice(0, 20)`
      );
  }

  if (pkgName === "core") {
    if (debug) console.log(`Debug Core: Found ${exports.length} exports`);
  }

  // Debug: If a module has no exports, dump its AST statements for troubleshooting
  if (exports.length === 0) {
    const stmtKinds = sourceFile.statements.map((s) => ts.SyntaxKind[s.kind]);
    if (debug)
      console.log(
        `Debug ${pkgName}: No exports found. Source statements:`,
        stmtKinds
      );
    // Also print the first few statements' text (trimmed) for context
    const firstStmts = sourceFile.statements
      .slice(0, 5)
      .map((s) => s.getText().slice(0, 200).replace(/\n/g, " "));
    if (debug) console.log(`Debug ${pkgName}: First statements:`, firstStmts);
  }

  // If the top-level index uses re-export statements (export * from "./...")
  // the moduleSymbol may not include re-exported symbols. In that case,
  // iterate over ExportDeclaration module specifiers and collect exported symbols
  // from the referenced files directly.
  function resolveSpecifierToFile(specifier: string) {
    const baseDir = path.dirname(src);
    const candidatePaths = [
      path.resolve(baseDir, specifier + ".ts"),
      path.resolve(baseDir, specifier + ".tsx"),
      path.resolve(baseDir, specifier, "index.ts"),
      path.resolve(baseDir, specifier, "index.tsx"),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  if (exports.length === 0) {
    for (const stmt of sourceFile.statements) {
      if (
        ts.isExportDeclaration(stmt) &&
        stmt.moduleSpecifier &&
        ts.isStringLiteral(stmt.moduleSpecifier)
      ) {
        const spec = stmt.moduleSpecifier.text;
        const resolved = resolveSpecifierToFile(spec);
        if (!resolved) continue;
        const targetSF = program.getSourceFile(resolved);
        if (!targetSF) continue;
        const targetSym = checker.getSymbolAtLocation(targetSF);
        if (!targetSym) continue;
        const childExports = checker.getExportsOfModule(targetSym);
        if (
          pkgName === "client" ||
          pkgName === "core" ||
          pkgName === "server"
        ) {
          if (debug)
            console.log(
              `Debug ${pkgName}: childExports for ${resolved}: ${childExports.length}`
            );
          if (debug)
            console.log(
              `Debug ${pkgName}: childExports names:`,
              childExports.map((c) => c.getName())
            );
        }
        if (childExports.length) {
          for (const ch of childExports) {
            // Prevent duplicates: push to exports list if not already there
            if (!exports.some((e) => e.name === ch.name)) exports.push(ch);
          }
        }
      }
    }
  }

  for (const exp of exports) {
    let symbol = exp;
    if (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
    }

    if (pkgName === "core") {
      if (debug)
        console.log(`Debug Core: Processing ${exp.name} -> ${symbol.name}`);
    }

    if (seen.has(symbol.name)) {
      if (pkgName === "core")
        if (debug) console.log(`Debug Core: Skipping duplicate ${symbol.name}`);
      continue;
    }
    seen.add(symbol.name);

    if (isInternal(symbol)) {
      if (pkgName === "core")
        if (debug) console.log(`Debug Core: Skipping internal ${symbol.name}`);
      continue;
    }

    const decl = symbol.valueDeclaration || symbol.declarations?.[0];
    if (!decl) {
      if (pkgName === "core")
        if (debug) console.log(`Debug Core: No declaration for ${symbol.name}`);
      continue;
    }

    if (ts.isClassDeclaration(decl)) {
      output += renderClassAPI(exp.getName(), symbol, checker, pkgName) + "\n";
    } else {
      output += `### ${exp.getName()}\n\n`;
      const doc = getDoc(symbol, checker);
      if (doc) output += `${doc}\n\n`;
      const declPath = decl.getSourceFile().fileName;
      output += `<AutoTypeTable path="${declPath}" name="${exp.getName()}" />\n\n`;
    }
  }

  const outPath = path.join(outputDir, `${pkgName}.mdx`);
  fs.writeFileSync(outPath, output, "utf8");
  console.log(`Generated: ${outPath}`);
}

// Main runner
const packages = fs.readdirSync(packagesDir);
for (const pkg of packages) {
  const full = path.join(packagesDir, pkg);
  if (fs.lstatSync(full).isDirectory()) processPackage(full);
}

console.log("✓ API docs generation complete.");
