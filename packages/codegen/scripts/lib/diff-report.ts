import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const IGNORED = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)dist-[^/]+(\/|$)/,
  /(^|\/)\.turbo(\/|$)/,
  /\.tsbuildinfo$/,
  /^test\/snapshots\//,
];

const listFiles = (root: string): string[] => {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      if (IGNORED.some((re) => re.test(rel))) {
        continue;
      }
      if (entry.isDirectory()) {
        visit(full);
      } else {
        out.push(rel);
      }
    }
  };
  visit(root);
  return out.sort();
};

export interface DiffSummary {
  identical: string[];
  different: string[];
  missing: string[];
  extra: string[];
}

/** Compares two output trees and writes unified diffs of the differing files into the sibling `<actual>.diffs` directory. */
export function writeDiffReport(expectedDir: string, actualDir: string): DiffSummary {
  const expected = listFiles(expectedDir);
  const actual = new Set(listFiles(actualDir));
  const summary: DiffSummary = { identical: [], different: [], missing: [], extra: [] };
  const diffsDir = join(actualDir, "..", `${actualDir.split("/").pop()}.diffs`);
  rmSync(diffsDir, { recursive: true, force: true });

  for (const file of expected) {
    if (!actual.has(file)) {
      summary.missing.push(file);
      continue;
    }
    actual.delete(file);
    const a = readFileSync(join(expectedDir, file));
    const b = readFileSync(join(actualDir, file));
    if (a.equals(b)) {
      summary.identical.push(file);
      continue;
    }
    summary.different.push(file);
    const result = spawnSync(
      "diff",
      [
        "-u",
        "--label",
        `expected/${file}`,
        "--label",
        `actual/${file}`,
        join(expectedDir, file),
        join(actualDir, file),
      ],
      {
        encoding: "utf-8",
        maxBuffer: 64 * 1024 * 1024,
      }
    );
    const diffPath = join(diffsDir, `${file}.diff`);
    mkdirSync(dirname(diffPath), { recursive: true });
    writeFileSync(diffPath, result.stdout);
  }
  summary.extra = [...actual].sort();

  return summary;
}

export const statDir = (dir: string): boolean => {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
};
