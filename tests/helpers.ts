import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import { closeDatabasePool } from '../src/config/database.js';
import { closeRedisConnection } from '../src/config/redis.js';

/**
 * Test Helpers — Shared utilities for integration tests.
 */

// Demo credentials (must match seed data)
export const ADMIN_CREDS = { email: 'admin@zorvyn.io', password: 'Password123!' };
export const ANALYST_CREDS = { email: 'analyst@zorvyn.io', password: 'Password123!' };
export const VIEWER_CREDS = { email: 'viewer@zorvyn.io', password: 'Password123!' };

/**
 * Login and return an access token
 */
export async function getToken(credentials: { email: string; password: string }): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send(credentials)
    .expect(200);

  return res.body.data.tokens.accessToken;
}

/**
 * Create an authenticated request helper
 */
export function authRequest(token: string) {
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}

/**
 * Global teardown — close connections after all tests
 */
export async function globalTeardown(): Promise<void> {
  await closeDatabasePool();
  await closeRedisConnection();
}
