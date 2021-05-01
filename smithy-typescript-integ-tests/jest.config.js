module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest",
    },
    testMatch: ["**/src/**/?(*.)+(spec|test).ts"],
    globals: {
        "ts-jest": {
            tsconfig: "tsconfig.json",
        },
    },
};
