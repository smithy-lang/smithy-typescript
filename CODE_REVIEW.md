# Code Review

General guide for code review.

## TypeScript source code

This covers the `@smithy/*` scoped core runtime for JavaScript.

### Runtime Environments

We support the Node.js runtime, modern commonly used browsers, and react-native. To ensure that these runtime
environments are API-equivalent, we have validation scripts in the core package that require all Node.js/browser/native
implementations to have equivalent API surfaces. Exported runtime symbols and type symbols are examined.

- For any usage of the `node:` modules or functionality not present in browsers, an alternate implementation must be
  provided for browsers. The native implementation defaults to the browser one unless a separate `index.native.ts` is
  implemented.
    - In some cases, there is no alternate in browsers. This must be clearly indicated at the `index.ts` level by the
      symbol `Symbol.for("node-only")` when implementing export symbol matching. Examples may be found in `@smithy/core`
      submodule indexes.

### Language Target Level

- The runtime code must be understood by the
  stated [minimum supported language level](https://aws.amazon.com/blogs/developer/aws-sdk-for-javascript-aligns-with-node-js-release-schedule/).
- We do not use experimental language features that require polyfills or transform steps to run in Node.js.
    - caveat: our 3rd supported runtime environment, react-native, may require polyfills. The react-native runtime has
      historically been non-standard to the point that we should not let it influence the default Node.js
      implementation.

### Code priorities

1. Correctness & Security
2. Runtime performance
3. Brevity and initialization performance
4. Readability

When making a trade-off between readability and performance, prioritize _performance_. Readability can be provided by
comments, whereas performance cannot.

Within performance, balance throughput performance and code-size, which affects initialization time. There will also be
a point where performance gains are small enough that an optimization should not be made. This is not predefined and
left to the reviewer.

### Building blocks for runtime performance

- Stable memory allocation: for hot code, pre-allocate the workspace (e.g. a byte array), work within it, and only allow
  it to be garbage-collected after leaving the hot code path.
- Minimize intermediate collections like `Object.keys()`.
- Minimize copying like `{ ...data }`.
- Minimize function scope depth.
- Minimize function scope traversal including recursion.
- Minimize object allocation, including the creation of closures.

### API surface

We want to provide as small an API surface as possible.

This is not because we don't want to provide features to our users. We want to avoid situations where users have built
solutions on top of non-public APIs that we later change or remove.

To ensure that we have visibility on the API surface of the runtime, we have an API snapshot check that runs during
integration testing.

- `export *` statements are banned for new code. `export *` creates an API surface that
  is not diff-visible between changes, and leads to leaking implementation details.
- Things of interest to the reader must appear closer to the top.
    - One concrete implementation for this is that in classes, `public` methods must come before `protected`. `private`
      comes last. For non-classes, apply the same reasoning with your own judgment.

```ts
/**
 * Description goes here.
 *
 * @example
 * const impl = new Impl();
 *
 * @public
 */
export class Impl {
    public prop1;
    private prop2;

    public constructor() {
    }

    /**
     * Static factory.
     */
    public static method1() {
    }

    /**
     * @returns something.
     */
    public method2() {
    }

    private static method3() {
    }

    private method4() {
    }
}

const moduleInternal = () => {
};
```

### Code comment block documentation (tsdoc)

We write code comments to the https://tsdoc.org/ specification.

- The free-form description (optional) of a symbol must come first. All annotations must come below this description.
- For any symbol exported from a package, it must have an access level annotation, `@public` or `@internal`.
    - In limited circumstances `@alpha` and `@beta` may be used.
- For non-exported symbols, you do not need to write comments for all symbols. Use your judgment here.
- You may opt to write a free-form description of a method in lieu of writing the API annotations `@param` and
  `@returns` etc.
- Comments explain "why?", not "how?". The code says "how".

# Java source code - "codegen"

- Optimize performance by creating cached `KnowledgeIndex` objects. Avoid repeated traversal of a service model for
  static information.
- Avoid excessive logging to the WARN and INFO channels.