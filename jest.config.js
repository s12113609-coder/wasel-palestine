module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['dotenv/config'],
  testTimeout: 15000,
  verbose: true,
};
