import request from 'supertest';
import app from '../src/app.js';
import { getToken, authRequest, ADMIN_CREDS, globalTeardown } from './helpers.js';

/**
 * Financial Records CRUD Tests
 * 
 * Tests the full lifecycle: create, read, update, delete.
 * Validates precision money handling and filtering.
 */
describe('Financial Records', () => {
  let adminToken: string;
  let createdRecordId: string;

  beforeAll(async () => {
    adminToken = await getToken(ADMIN_CREDS);
  });

  afterAll(async () => {
    await globalTeardown();
  });

  describe('POST /api/v1/records', () => {
    it('should create a record with precise decimal amount', async () => {
      const res = await authRequest(adminToken)
        .post('/api/v1/records')
        .send({
          amount: '99999.9999',
          type: 'income',
          category: 'integration-test',
          description: 'Precision money test',
          date: '2026-04-01',
          department: 'headquarters',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe('99999.9999');
      expect(res.body.data.type).toBe('income');
      expect(res.body.data.category).toBe('integration-test');
      createdRecordId = res.body.data.id;
    });

    it('should reject negative amount', async () => {
      const res = await authRequest(adminToken)
        .post('/api/v1/records')
        .send({
          amount: '-500.0000',
          type: 'expense',
          category: 'test',
          date: '2026-04-01',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid type', async () => {
      const res = await authRequest(adminToken)
        .post('/api/v1/records')
        .send({
          amount: '1000.0000',
          type: 'invalid',
          category: 'test',
          date: '2026-04-01',
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing required fields', async () => {
      const res = await authRequest(adminToken)
        .post('/api/v1/records')
        .send({ amount: '1000.0000' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/records', () => {
    it('should return paginated records', async () => {
      const res = await authRequest(adminToken).get('/api/v1/records?page=1&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.total).toBeDefined();
      expect(res.body.meta.totalPages).toBeDefined();
    });

    it('should filter by type', async () => {
      const res = await authRequest(adminToken).get('/api/v1/records?type=income');

      expect(res.status).toBe(200);
      res.body.data.forEach((record: any) => {
        expect(record.type).toBe('income');
      });
    });

    it('should filter by category', async () => {
      const res = await authRequest(adminToken).get('/api/v1/records?category=integration-test');

      expect(res.status).toBe(200);
      res.body.data.forEach((record: any) => {
        expect(record.category).toBe('integration-test');
      });
    });
  });

  describe('GET /api/v1/records/:id', () => {
    it('should return a record by ID', async () => {
      const res = await authRequest(adminToken).get(`/api/v1/records/${createdRecordId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdRecordId);
      expect(res.body.data.amount).toBe('99999.9999');
    });

    it('should return 404 for non-existent ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await authRequest(adminToken).get(`/api/v1/records/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/records/:id', () => {
    it('should update a record', async () => {
      const res = await authRequest(adminToken)
        .put(`/api/v1/records/${createdRecordId}`)
        .send({ amount: '75000.5000', category: 'updated-test' });

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe('75000.5000');
      expect(res.body.data.category).toBe('updated-test');
    });
  });

  describe('DELETE /api/v1/records/:id', () => {
    it('should soft-delete a record', async () => {
      const res = await authRequest(adminToken).delete(`/api/v1/records/${createdRecordId}`);

      expect(res.status).toBe(200);

      // Verify it's gone from listing
      const getRes = await authRequest(adminToken).get(`/api/v1/records/${createdRecordId}`);
      expect(getRes.status).toBe(404);
    });
  });
});
