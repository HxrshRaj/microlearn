module.exports = {
  // Integration tests rebuild an in-memory database (real migrations + seed)
  // in beforeEach and drive real password hashing through the app -- give
  // CI headroom on a slower/shared runner beyond Jest's 5s default.
  testTimeout: 20000,
  // mern/ has its own package, deps and MongoDB-backed suite (run in its own CI job).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/mern/'],
};
