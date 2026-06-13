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
