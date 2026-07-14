/**
 * Fast ES module transpilation using oxc-transform.
 * Replaces `tsc -p tsconfig.es.json` (which uses noCheck, i.e. transpile-only).
 *
 * Usage: node ../../scripts/compilation/build-es.js
 *   (run from a package directory)
 *
 * Can also be required and called as buildEs(packageDir).
 */
const { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } = require("node:fs");
const path = require("node:path");

/**
 * Toggle between oxc-transform and tsc (transpileModule) for type stripping.
 * tsc preserves source formatting; oxc reformats from AST.
 */
const USE_TSC = true;

let transformSync, parseSync, ts;
if (USE_TSC) {
  ts = require("typescript");
} else {
  ({ transformSync } = require("oxc-transform"));
  ({ parseSync } = require("oxc-parser"));
}

/**
 * Collect all TemplateLiteral span ranges [start, end] from an AST node.
 */
function collectTemplateLiteralSpans(node, spans) {
  if (!node || typeof node !== "object") return;
  if (node.type === "TemplateLiteral") {
    spans.push([node.start, node.end]);
  }
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) collectTemplateLiteralSpans(item, spans);
    } else if (val && typeof val === "object" && val.type) {
      collectTemplateLiteralSpans(val, spans);
    }
  }
}

/**
 * Remove comments using oxc-parser's AST comment positions,
 * then strip blank lines only outside template literals.
 */
function stripComments(code) {
  const { comments, program } = parseSync("file.js", code);
  if (!comments.length) return code;
  let result = "";
  let last = 0;
  for (const { start, end } of comments) {
    result += code.slice(last, start);
    last = end;
  }
  result += code.slice(last);

  // Collect template literal spans from the stripped code.
  // Re-parse after comment removal to get accurate positions.
  const { program: strippedAst } = parseSync("file.js", result);
  const spans = [];
  collectTemplateLiteralSpans(strippedAst, spans);

  if (!spans.length) {
    return result.replace(/^\s*\n/gm, "");
  }

  // Remove blank lines only when they are not inside a template literal.
  const lines = result.split("\n");
  const filtered = [];
  let offset = 0;
  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = offset + line.length; // excludes the \n
    const isBlank = /^\s*$/.test(line);
    if (isBlank) {
      const insideTemplate = spans.some(([s, e]) => lineStart >= s && lineEnd <= e);
      if (!insideTemplate) {
        offset = lineEnd + 1;
        continue;
      }
    }
    filtered.push(line);
    offset = lineEnd + 1;
  }
  return filtered.join("\n");
}

/**
 * Maximum line length for inlining object/array literals.
 */
const INLINE_LIMIT = 999;

/**
 * Collect span ranges for string-like AST nodes (strings, templates, regex)
 * that should not have their whitespace modified.
 */
function collectProtectedSpans(node, spans) {
  if (!node || typeof node !== "object") return;
  const t = node.type;
  if (t === "TemplateLiteral") {
    spans.push([node.start, node.end]);
    return;
  }
  if (t === "Literal" && (typeof node.value === "string" || node.regex)) {
    spans.push([node.start, node.end]);
    return;
  }
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) collectProtectedSpans(item, spans);
    } else if (val && typeof val === "object" && val.type) {
      collectProtectedSpans(val, spans);
    }
  }
}

/**
 * Collect spans of ObjectExpression and ArrayExpression nodes (leaf-first).
 */
function collectLiteralSpans(node, spans) {
  if (!node || typeof node !== "object") return;
  const t = node.type;
  // Recurse first so children appear before parents (processed in reverse = parents first).
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) collectLiteralSpans(item, spans);
    } else if (val && typeof val === "object" && val.type) {
      collectLiteralSpans(val, spans);
    }
  }
  if (t === "ObjectExpression" || t === "ArrayExpression") {
    spans.push(node);
  }
}

/**
 * Inline multi-line object/array literals that fit within INLINE_LIMIT,
 * then minify whitespace on each line (preserving indentation and protected spans).
 */
function minifyFormat(code) {
  // Phase 1: inline literals that fit within INLINE_LIMIT.
  // Iterate until no more inlining is possible (handles nested literals
  // whose parents become inlineable after children are inlined).
  let changed = true;
  while (changed) {
    changed = false;
    const { program } = parseSync("file.js", code);
    const literalNodes = [];
    collectLiteralSpans(program, literalNodes);
    literalNodes.sort((a, b) => b.start - a.start);

    for (const node of literalNodes) {
      const { start, end } = node;
      const fragment = code.slice(start, end);
      if (!fragment.includes("\n")) continue;

      const lineStart = code.lastIndexOf("\n", start - 1) + 1;
      const linePrefix = code.slice(lineStart, start);
      const inlined = fragment
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s{2,}/g, " ");
      let lineEnd = code.indexOf("\n", end);
      if (lineEnd === -1) lineEnd = code.length;
      const fullLine = linePrefix + inlined + code.slice(end, lineEnd);

      if (fullLine.length <= INLINE_LIMIT) {
        code = code.slice(0, start) + inlined + code.slice(end);
        changed = true;
      }
    }
  }

  // Phase 2: minify whitespace per line, preserving indentation and protected spans.
  // Re-parse after inlining to get accurate protected spans.
  const { program: ast2 } = parseSync("file.js", code);
  const protectedSpans = [];
  collectProtectedSpans(ast2, protectedSpans);
  // Sort by start for binary search.
  protectedSpans.sort((a, b) => a[0] - b[0]);

  const lines = code.split("\n");
  let offset = 0;
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i];
    const lineStart = offset;
    const lineEnd = offset + line.length;

    // Extract indentation.
    const match = line.match(/^(\t*)/);
    const indentation = match ? match[1] : "";
    const content = line.slice(indentation.length);

    if (content.length === 0) {
      offset = lineEnd + 1;
      continue;
    }

    // Minify content: remove unnecessary spaces, but skip protected regions.
    const contentStart = lineStart + indentation.length;
    let minified = "";
    let j = 0;
    while (j < content.length) {
      const absPos = contentStart + j;
      // Check if we're inside a protected span.
      const prot = findProtectedSpan(protectedSpans, absPos);
      if (prot) {
        // Copy the protected content verbatim until end of span or end of line content.
        const protEnd = Math.min(prot[1], lineEnd) - contentStart;
        minified += content.slice(j, protEnd);
        j = protEnd;
        continue;
      }
      const ch = content[j];
      if (ch === " " || ch === "\t") {
        // Determine if this space is necessary.
        // Keep space between two identifier/keyword characters (alnum, _, $).
        const prev = minified[minified.length - 1];
        const next = content[j + 1];
        if (prev && next && isIdentChar(prev) && isIdentChar(next)) {
          minified += " ";
        }
        // Otherwise skip.
        ++j;
      } else {
        minified += ch;
        ++j;
      }
    }
    lines[i] = indentation + minified;
    offset = lineEnd + 1;
  }
  code = lines.join("\n");

  // Phase 3: ensure semicolons that end statements produce a newline.
  // Re-parse and collect positions of statement starts that share a line with
  // a previous statement's semicolon.
  {
    const { program: ast3 } = parseSync("file.js", code);
    const splits = []; // positions where a newline + indent should be inserted.
    collectStatementSplits(ast3, code, splits);
    // Apply splits in reverse order.
    splits.sort((a, b) => b.pos - a.pos);
    for (const { pos, indent } of splits) {
      code = code.slice(0, pos) + "\n" + indent + code.slice(pos);
    }
  }

  return code;
}

/**
 * Walk the AST to find consecutive statements on the same line.
 * When a statement follows a semicolon on the same line, record a split point.
 */
function collectStatementSplits(node, code, splits) {
  if (!node || typeof node !== "object") return;
  // Process statement lists (Program.body, BlockStatement.body, SwitchCase.consequent).
  const bodies = [];
  if (node.type === "Program" || node.type === "BlockStatement" || node.type === "StaticBlock") {
    bodies.push(node.body);
  }
  if (node.type === "SwitchCase" && node.consequent) {
    bodies.push(node.consequent);
  }

  for (const stmts of bodies) {
    if (!Array.isArray(stmts)) continue;
    // Determine the block's indentation from the first statement that starts at column 0
    // of its line (i.e., the line contains only indentation before the statement).
    let blockIndent = null;
    for (const stmt of stmts) {
      if (!stmt) continue;
      const ls = code.lastIndexOf("\n", stmt.start - 1) + 1;
      const before = code.slice(ls, stmt.start);
      if (/^\t*$/.test(before)) {
        blockIndent = before;
        break;
      }
    }
    if (blockIndent === null) {
      // Fallback: use parent node indentation.
      if (node.type === "Program") {
        blockIndent = "";
      } else {
        const ls = code.lastIndexOf("\n", node.start - 1) + 1;
        const before = code.slice(ls, node.start);
        blockIndent = (before.match(/^(\t*)/)[1]) + "\t";
      }
    }

    for (let i = 1; i < stmts.length; ++i) {
      const prev = stmts[i - 1];
      const curr = stmts[i];
      if (!prev || !curr) continue;
      // Check if they're on the same line (no newline between prev.end and curr.start).
      const between = code.slice(prev.end, curr.start);
      if (between.includes("\n")) continue;
      splits.push({ pos: curr.start, indent: blockIndent });
    }
  }

  // Recurse into child nodes.
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) collectStatementSplits(item, code, splits);
    } else if (val && typeof val === "object" && val.type) {
      collectStatementSplits(val, code, splits);
    }
  }
}

function isIdentChar(ch) {
  const c = ch.charCodeAt(0);
  // a-z, A-Z, 0-9, _, $
  return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95 || c === 36;
}

/**
 * Binary search for a protected span containing the given position.
 */
function findProtectedSpan(spans, pos) {
  let lo = 0, hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (spans[mid][1] <= pos) {
      lo = mid + 1;
    } else if (spans[mid][0] > pos) {
      hi = mid - 1;
    } else {
      return spans[mid];
    }
  }
  return null;
}

function processDir(dir, srcDir, outDir, compilerOptions) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += processDir(fullPath, srcDir, outDir, compilerOptions);
    } else if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".d.ts") &&
      !entry.name.endsWith(".spec.ts") &&
      !entry.name.endsWith(".fixture.ts") &&
      !entry.name.endsWith(".mock.ts") &&
      !entry.name.endsWith(".bench.ts") &&
      !entry.name.startsWith("vitest.")
    ) {
      const relPath = path.relative(srcDir, fullPath);
      const outPath = path.join(outDir, relPath.replace(/\.ts$/, ".js"));
      mkdirSync(path.dirname(outPath), { recursive: true });
      const source = readFileSync(fullPath, "utf-8");

      let code;
      if (USE_TSC) {
        const result = ts.transpileModule(source, {
          fileName: fullPath,
          compilerOptions,
        });
        code = result.outputText;
      } else {
        const result = transformSync(fullPath, source, { sourcemap: false });
        if (result.errors.length) {
          console.error(`Errors in ${fullPath}:`, result.errors);
          process.exit(1);
        }
        code = result.code;
      }

      writeFileSync(outPath, USE_TSC ? code : minifyFormat(stripComments(code)));
      count++;
    }
  }
  return count;
}

/**
 * Transpile src/ -> dist-es/ for a given package directory.
 * @param {string} packageDir - absolute path to the package root.
 * @returns {number} number of files transpiled.
 */
function buildEs(packageDir) {
  const srcDir = path.join(packageDir, "src");
  const outDir = path.join(packageDir, "dist-es");

  // Clear dist-es contents before building.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  let compilerOptions;
  if (USE_TSC) {
    const configPath = ts.findConfigFile(packageDir, ts.sys.fileExists, "tsconfig.es.json");
    const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
    ({ options: compilerOptions } = ts.parseJsonConfigFileContent(config, ts.sys, packageDir));
  }

  return processDir(srcDir, srcDir, outDir, compilerOptions);
}

module.exports = buildEs;

// Run directly when invoked as a script.
if (require.main === module) {
  buildEs(process.cwd());
}
