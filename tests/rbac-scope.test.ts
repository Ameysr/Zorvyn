import request from 'supertest';
import app from '../src/app.js';
import { getToken, authRequest, ADMIN_CREDS, ANALYST_CREDS, VIEWER_CREDS, globalTeardown } from './helpers.js';

/**
 * RBAC & Scope Isolation Tests
 * 
 * Validates that:
 * 1. Role-based access control is enforced
 * 2. Department-level data scoping works correctly
 * 3. Admins have cross-department access
 */
describe('RBAC & Scope Isolation', () => {
  let adminToken: string;
  let analystToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    adminToken = await getToken(ADMIN_CREDS);
    analystToken = await getToken(ANALYST_CREDS);
    viewerToken = await getToken(VIEWER_CREDS);
  });

  afterAll(async () => {
    await globalTeardown();
  });

  describe('Role-Based Access Control', () => {
    it('admin should access user management endpoints', async () => {
      const res = await authRequest(adminToken).get('/api/v1/users');
      expect(res.status).toBe(200);
    });

    it('analyst should be DENIED user management access', async () => {
      const res = await authRequest(analystToken).get('/api/v1/users');
      expect(res.status).toBe(403);
    });

    it('viewer should be DENIED user management access', async () => {
      const res = await authRequest(viewerToken).get('/api/v1/users');
      expect(res.status).toBe(403);
    });

    it('viewer should NOT create financial records', async () => {
      const res = await authRequest(viewerToken)
        .post('/api/v1/records')
        .send({
          amount: '5000.0000',
          type: 'income',
          category: 'test',
          date: '2026-04-01',
        });

      expect(res.status).toBe(403);
    });

    it('admin should create financial records', async () => {
      const res = await authRequest(adminToken)
        .post('/api/v1/records')
        .send({
          amount: '5000.0000',
          type: 'income',
          category: 'test-rbac',
          description: 'RBAC test record',
          date: '2026-04-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.category).toBe('test-rbac');
    });

    it('viewer should read financial records (own department)', async () => {
      const res = await authRequest(viewerToken).get('/api/v1/records');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('analyst should access dashboard endpoints', async () => {
      const res = await authRequest(analystToken).get('/api/v1/dashboard/summary');
      expect(res.status).toBe(200);
    });

    it('viewer should be DENIED dashboard summary', async () => {
      const res = await authRequest(viewerToken).get('/api/v1/dashboard/summary');
      expect(res.status).toBe(403);
    });

    it('viewer should access recent activity', async () => {
      const res = await authRequest(viewerToken).get('/api/v1/dashboard/recent-activity');
      expect(res.status).toBe(200);
    });
  });

  describe('Department Scope Isolation', () => {
    it('admin should see ALL records (cross-department)', async () => {
      const res = await authRequest(adminToken).get('/api/v1/records');

      expect(res.status).toBe(200);
      const departments = new Set(res.body.data.map((r: any) => r.department));
      // Admin should see multiple departments
      expect(departments.size).toBeGreaterThanOrEqual(2);
    });

    it('viewer should ONLY see own department records', async () => {
      const res = await authRequest(viewerToken).get('/api/v1/records');

      expect(res.status).toBe(200);
      // All records should be from viewer's department (marketing)
      const departments = new Set(res.body.data.map((r: any) => r.department));
      expect(departments.size).toBe(1);
      expect(departments.has('marketing')).toBe(true);
    });

    it('analyst should ONLY see own department records', async () => {
      const res = await authRequest(analystToken).get('/api/v1/records');

      expect(res.status).toBe(200);
      const departments = new Set(res.body.data.map((r: any) => r.department));
      expect(departments.size).toBe(1);
      expect(departments.has('finance')).toBe(true);
    });

    it('viewer should NOT access records from another department by ID', async () => {
      // Get an admin record (HQ department)
      const adminRes = await authRequest(adminToken).get('/api/v1/records?limit=1');
      const hqRecord = adminRes.body.data.find((r: any) => r.department !== 'marketing');

      if (hqRecord) {
        const res = await authRequest(viewerToken).get(`/api/v1/records/${hqRecord.id}`);
        expect(res.status).toBe(404); // Scoped out — invisible to viewer
      }
    });
  });
});
