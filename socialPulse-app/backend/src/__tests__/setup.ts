import dotenv from 'dotenv';
import { join } from 'path';

// Load test environment variables before any application modules are imported
dotenv.config({ path: join(__dirname, '../../.env.test') });

if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Mock Bull queue globally for integration tests to prevent connecting to a real Redis instance
jest.mock('bull', () => {
    return jest.fn().mockImplementation((queueName) => {
        return {
            process: jest.fn(),
            add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
            on: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined),
        };
    });
});

// Mock ioredis globally to prevent real Redis TCP connections during tests
jest.mock('ioredis', () => {
    const RedisMock = jest.fn().mockImplementation(() => ({
        on: jest.fn().mockReturnThis(),
        once: jest.fn().mockReturnThis(),
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        quit: jest.fn().mockResolvedValue('OK'),
        status: 'ready',
        duplicate: jest.fn().mockReturnThis(),
    }));
    (RedisMock as any).default = RedisMock;
    return RedisMock;
});

// Mock bullmq globally to prevent real queue and worker connections
jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
    })),
    QueueEvents: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
    })),
}));
