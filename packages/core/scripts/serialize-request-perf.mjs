/**
 * Benchmark: serializeRequest with vs. without input spread + delete
 *
 * Measures the cost of the shallow copy ({ ...input }) and delete operations
 * that were previously performed in HttpBindingProtocol.serializeRequest and
 * RpcProtocol.serializeRequest.
 *
 * Setup:
 *   cd packages/core
 *   yarn build        # or: npx tsc -p tsconfig.es.json
 *   node scripts/serialize-request-perf.mjs
 *
 * What it measures:
 *   1. Baseline: iterate schema members and read from input (current code path)
 *   2. Spread+delete: shallow copy input, iterate, delete HTTP-bound keys (old code path)
 *
 * The benchmark isolates the spread/delete overhead from actual serialization
 * by using a minimal stub serializer.
 */

const ITERATIONS = 500_000;
const WARMUP = 50_000;

// Fraction of members that are HTTP-bound (label, header, query, etc.)
const HTTP_BOUND_RATIO = 0.3;

// Simulate inputs of varying sizes
const inputs = {
  "small (5 members)": buildInput(5),
  "medium (20 members)": buildInput(20),
  "large (50 members)": buildInput(50),
  "xlarge (100 members)": buildInput(100),
};

function buildInput(memberCount) {
  const input = {};
  const memberNames = [];
  const httpBoundMembers = new Set();

  for (let i = 0; i < memberCount; i++) {
    const key = `field${i}`;
    input[key] = `value-${i}`;
    memberNames.push(key);
    if (i < Math.floor(memberCount * HTTP_BOUND_RATIO)) {
      httpBoundMembers.add(key);
    }
  }
  return { input, memberNames, httpBoundMembers };
}

/**
 * Simulates the OLD code path:
 *   const input = { ..._input };
 *   for (member of schema) { ... delete input[member]; }
 */
function withSpreadAndDelete(originalInput, memberNames, httpBoundMembers) {
  const input = { ...originalInput };
  let bodyMemberCount = 0;
  for (const name of memberNames) {
    if (httpBoundMembers.has(name)) {
      // simulate reading the value for HTTP binding serialization
      void input[name];
      delete input[name];
    } else {
      // simulate reading the value for body serialization
      void input[name];
      bodyMemberCount++;
    }
  }
  return bodyMemberCount;
}

/**
 * Simulates the NEW code path:
 *   No copy, no delete. Just iterate schema members.
 */
function withoutSpreadOrDelete(originalInput, memberNames, httpBoundMembers) {
  let bodyMemberCount = 0;
  for (const name of memberNames) {
    if (httpBoundMembers.has(name)) {
      void originalInput[name];
    } else {
      void originalInput[name];
      bodyMemberCount++;
    }
  }
  return bodyMemberCount;
}

console.log(`Benchmark: serializeRequest input spread+delete overhead`);
console.log(`Iterations: ${ITERATIONS.toLocaleString()} (warmup: ${WARMUP.toLocaleString()})\n`);

class Row {
  constructor(data) {
    Object.assign(this, data);
  }
}

const rows = {};

for (const [label, { input, memberNames, httpBoundMembers }] of Object.entries(inputs)) {
  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    withSpreadAndDelete(input, memberNames, httpBoundMembers);
    withoutSpreadOrDelete(input, memberNames, httpBoundMembers);
  }

  // Benchmark: old path (spread + delete)
  const startOld = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    withSpreadAndDelete(input, memberNames, httpBoundMembers);
  }
  const oldMs = performance.now() - startOld;

  // Benchmark: new path (no spread, no delete)
  const startNew = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    withoutSpreadOrDelete(input, memberNames, httpBoundMembers);
  }
  const newMs = performance.now() - startNew;

  const speedup = (oldMs / newMs).toFixed(2);
  const savedPerOp = ((oldMs - newMs) / ITERATIONS * 1000).toFixed(1);

  rows[label] = new Row({
    members: memberNames.length,
    "http-bound": httpBoundMembers.size,
    "old (ms)": oldMs.toFixed(1),
    "new (ms)": newMs.toFixed(1),
    speedup: `${speedup}x`,
    "saved/op (µs)": savedPerOp,
  });
}

console.table(rows);
console.log("\n'old' = shallow copy + delete (previous code)");
console.log("'new' = direct access, no copy or delete (current code)");
