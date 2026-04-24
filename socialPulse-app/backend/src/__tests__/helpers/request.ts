import supertest from 'supertest';
import { app } from '../../app';

// Shared supertest agent — reuse across test files.
export const request = supertest(app);

/** Register a user and return their JWT token + id. */
export async function registerAndLogin(overrides: {
    email?: string;
    password?: string;
    fullName?: string;
} = {}): Promise<{ token: string; userId: string; email: string }> {
    const email    = overrides.email    ?? `test_${Date.now()}@example.com`;
    const password = overrides.password ?? 'Password123!';
    const fullName = overrides.fullName ?? 'Test User';

    const res = await request
        .post('/api/auth/register')
        .send({ email, password, fullName });

    if (res.status !== 201 && res.status !== 200) {
        throw new Error(`register failed: ${JSON.stringify(res.body)}`);
    }

    return { token: res.body.token as string, userId: res.body.user.id as string, email };
}

/** Return an Authorization header object. */
export function bearer(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
}
