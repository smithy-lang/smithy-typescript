const { compilerOptions } = require("@tsconfig/recommended/tsconfig.json");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", {
        tsconfig: {
            ...compilerOptions,
            noImplicitAny: false,
            strictNullChecks: false
        }
    }]
  },
  globals: {
    "ts-jest": {
        ...compilerOptions,
        noImplicitAny: false,
        strictNullChecks: false
    }
  },
  testMatch: ["**/*.spec.ts", "!**/*.integ.spec.ts"],
};
