/* eslint-disable */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  coverageReporters: ["lcov", "json", "html", "text"],
  fakeTimers: { enableGlobally: true },
};
