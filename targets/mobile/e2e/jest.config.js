/**
 * @file Jest runner config for the Detox (on-device) suite.
 *
 * Deliberately separate from the component suite's config (the `jest` block in `package.json`,
 * `testMatch: **\/__tests__\/**`): these specs need a booted device, take minutes, and must run
 * serially — they'd be a disaster inside the fast unit gate. `npm test` never runs them; `npm run
 * e2e` does.
 */
module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/e2e/**/*.test.js"],
  testTimeout: 600000,
  maxWorkers: 1,
  globalSetup: "detox/runners/jest/globalSetup",
  globalTeardown: "detox/runners/jest/globalTeardown",
  reporters: ["detox/runners/jest/reporter"],
  testEnvironment: "detox/runners/jest/testEnvironment",
  verbose: true,
};
