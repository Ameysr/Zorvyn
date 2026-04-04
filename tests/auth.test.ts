import request from 'supertest';
import app from '../src/app.js';
import { getToken, ADMIN_CREDS, ANALYST_CREDS, VIEWER_CREDS, globalTeardown } from './helpers.js';

/**
 * Authentication Tests
 * 
 * Tests registration, login, token refresh, logout,
 * and validation edge cases.
 */
describe('Auth Module', () => {
  afterAll(async () => {
    await globalTeardown();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const uniqueEmail = `test-${Date.now()}@zorvyn.io`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail,
          password: 'Password123!',
          full_name: 'Test User',
          department: 'engineering',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(uniqueEmail);
      expect(res.body.data.user.role).toBe('viewer'); // default role
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      // Password hash must NOT be in response
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('should reject registration with weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'weak@zorvyn.io',
          password: '123',
          full_name: 'Weak User',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'admin@zorvyn.io',
          password: 'Password123!',
          full_name: 'Duplicate',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'incomplete@zorvyn.io' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials and return tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(ADMIN_CREDS);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(ADMIN_CREDS.email);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_CREDS.email, password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@zorvyn.io', password: 'Password123!' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // Login first to get a refresh token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send(ADMIN_CREDS);

      const refreshToken = loginRes.body.data.tokens.refreshToken;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      // New refresh token should be different (rotation)
      expect(res.body.data.tokens.refreshToken).not.toBe(refreshToken);
    });

    it('should reject reused refresh token (rotation)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send(ADMIN_CREDS);

      const refreshToken = loginRes.body.data.tokens.refreshToken;

      // Use token once (should succeed)
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Use same token again (should fail — it's been rotated)
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(401);
    });
  });

  describe('Protected Routes', () => {
    it('should reject requests without Authorization header', async () => {
      const res = await request(app).get('/api/v1/users');

      expect(res.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });
  });
});
