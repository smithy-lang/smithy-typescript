/**
 * Fast ES module transpilation using oxc-transform.
 * Replaces `tsc -p tsconfig.es.json` (which uses noCheck, i.e. transpile-only).
 *
 * Usage: node ../../scripts/compilation/build-es.js
 *   (run from a package directory)
 *
 * Can also be required and called as buildEs(packageDir).
 */
const { transformSync } = require("oxc-transform");
const { parseSync } = require("oxc-parser");
const { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } = require("node:fs");
const path = require("node:path");

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
const INLINE_LIMIT = 300;

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
 * Collect spans of ObjectExpression and ArrayExpression nodes.
 */
function collectLiteralSpans(node, spans) {
  if (!node || typeof node !== "object") return;
  const t = node.type;
  if (t === "ObjectExpression" || t === "ArrayExpression") {
    spans.push([node.start, node.end, t]);
  }
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) collectLiteralSpans(item, spans);
    } else if (val && typeof val === "object" && val.type) {
      collectLiteralSpans(val, spans);
    }
  }
}

/**
 * Inline multi-line object/array literals that fit within INLINE_LIMIT,
 * then minify whitespace on each line (preserving indentation and protected spans).
 */
function minifyFormat(code) {
  const { program } = parseSync("file.js", code);

  // Phase 1: inline short object/array literals.
  const literalSpans = [];
  collectLiteralSpans(program, literalSpans);
  // Sort by start descending so replacements don't shift earlier positions.
  literalSpans.sort((a, b) => b[0] - a[0]);

  for (const [start, end] of literalSpans) {
    const fragment = code.slice(start, end);
    if (!fragment.includes("\n")) continue;
    // Compute the column where this literal starts (for line-length check).
    let lineStart = code.lastIndexOf("\n", start - 1) + 1;
    const indent = start - lineStart;
    // Collapse: replace newlines and surrounding whitespace with a single space,
    // then collapse internal runs of whitespace.
    const inlined = fragment
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s{2,}/g, " ");
    // Check if the line (indent + content before literal + inlined literal) fits.
    // Approximate: indent + distance from lineStart to end of inlined.
    const lineContent = code.slice(lineStart, start) + inlined;
    // Find end of line after the literal.
    let lineEnd = code.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = code.length;
    const fullLine = lineContent + code.slice(end, lineEnd);
    // Use tab=1 for length calculation (tabs are single indentation units).
    if (fullLine.length <= INLINE_LIMIT) {
      code = code.slice(0, start) + inlined + code.slice(end);
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
      if (ch === " ") {
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
  return lines.join("\n");
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

function processDir(dir, srcDir, outDir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += processDir(fullPath, srcDir, outDir);
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
      const { code, errors } = transformSync(fullPath, source, { sourcemap: false });
      if (errors.length) {
        console.error(`Errors in ${fullPath}:`, errors);
        process.exit(1);
      }
      writeFileSync(outPath, minifyFormat(stripComments(code)));
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

  return processDir(srcDir, srcDir, outDir);
}

module.exports = buildEs;

// Run directly when invoked as a script.
if (require.main === module) {
  buildEs(process.cwd());
}
