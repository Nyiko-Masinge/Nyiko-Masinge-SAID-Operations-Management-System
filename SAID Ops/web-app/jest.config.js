/** Runs the pure monitoring logic tests (detection engine and repositories). */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/data/monitoring/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};