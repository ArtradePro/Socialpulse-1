import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: 'src',
    testMatch: ['**/__tests__/**/*.test.ts'],
    globalSetup: './__tests__/globalSetup.ts',
    globalTeardown: './__tests__/globalTeardown.ts',
    testTimeout: 30000,
    collectCoverageFrom: [
        '**/*.ts',
        '!**/node_modules/**',
        '!**/__tests__/**',
        '!**/database/**',
        '!server.ts',
    ],
    coverageDirectory: '../coverage',
    coverageReporters: ['text', 'lcov'],
    transform: {
        '^.+\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
    },
};

export default config;
