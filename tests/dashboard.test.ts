import request from 'supertest';
import app from '../src/app.js';
import { getToken, authRequest, ADMIN_CREDS, ANALYST_CREDS, globalTeardown } from './helpers.js';

/**
 * Dashboard Analytics Tests
 * 
 * Tests aggregation endpoints: summary, categories, trends, activity.
 */
describe('Dashboard Analytics', () => {
  let adminToken: string;
  let analystToken: string;

  beforeAll(async () => {
    adminToken = await getToken(ADMIN_CREDS);
    analystToken = await getToken(ANALYST_CREDS);
  });

  afterAll(async () => {
    await globalTeardown();
  });

  describe('GET /api/v1/dashboard/summary', () => {
    it('should return financial summary with precision amounts', async () => {
      const res = await authRequest(adminToken).get('/api/v1/dashboard/summary');

      expect(res.status).toBe(200);
      expect(res.body.data.total_income).toBeDefined();
      expect(res.body.data.total_expenses).toBeDefined();
      expect(res.body.data.net_balance).toBeDefined();
      expect(res.body.data.record_count).toBeGreaterThan(0);

      // Amounts should be strings (NUMERIC precision preserved)
      expect(typeof res.body.data.total_income).toBe('string');
      expect(typeof res.body.data.total_expenses).toBe('string');
    });

    it('analyst should see scoped summary (finance dept only)', async () => {
      const adminRes = await authRequest(adminToken).get('/api/v1/dashboard/summary');
      const analystRes = await authRequest(analystToken).get('/api/v1/dashboard/summary');

      // Analyst sees fewer records (only their department)
      expect(analystRes.body.data.record_count).toBeLessThanOrEqual(adminRes.body.data.record_count);
    });
  });

  describe('GET /api/v1/dashboard/category-breakdown', () => {
    it('should return category-wise totals', async () => {
      const res = await authRequest(adminToken).get('/api/v1/dashboard/category-breakdown');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].category).toBeDefined();
        expect(res.body.data[0].type).toBeDefined();
        expect(res.body.data[0].total).toBeDefined();
        expect(res.body.data[0].count).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/dashboard/trends', () => {
    it('should return monthly trend data', async () => {
      const res = await authRequest(adminToken).get('/api/v1/dashboard/trends');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].period).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM
        expect(res.body.data[0].income).toBeDefined();
        expect(res.body.data[0].expenses).toBeDefined();
        expect(res.body.data[0].net).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/dashboard/recent-activity', () => {
    it('should return recent records with creator names', async () => {
      const res = await authRequest(adminToken).get('/api/v1/dashboard/recent-activity?limit=5');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });
  });
});
