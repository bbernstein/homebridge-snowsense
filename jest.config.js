/* eslint-disable */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  coverageReporters: ["lcov", "json", "html", "text"],
  // collectCoverageFrom: [
  //   "src/platformAccessory.ts",
  //   "src/SnowForecastService.ts",
  //   "src/SnowWatch.ts"
  // ],
};
