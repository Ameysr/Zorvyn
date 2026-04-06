/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  setupFiles: ['dotenv/config'],
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
};
