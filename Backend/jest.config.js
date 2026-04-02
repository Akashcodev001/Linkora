export default {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    setupFiles: ['<rootDir>/tests/setupEnv.js'],
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.routes.js'],
    coveragePathIgnorePatterns: ['/node_modules/'],
    testTimeout: 30000,
};
