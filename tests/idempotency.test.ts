import request from 'supertest';
import app from '../src/app.js';
import { getToken, authRequest, ADMIN_CREDS, globalTeardown } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Idempotency Layer Tests
 * 
 * Validates that duplicate POST requests with the same
 * X-Idempotency-Key return the cached response instead
 * of creating duplicate records.
 */
describe('Idempotency Layer', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getToken(ADMIN_CREDS);
  });

  afterAll(async () => {
    await globalTeardown();
  });

  it('should create a record on first request with idempotency key', async () => {
    const idempotencyKey = uuidv4();

    const res = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send({
        amount: '12345.6789',
        type: 'income',
        category: 'idempotency-test',
        description: 'First request',
        date: '2026-04-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.category).toBe('idempotency-test');
  });

  it('should return cached response on duplicate request', async () => {
    const idempotencyKey = uuidv4();
    const payload = {
      amount: '7777.0000',
      type: 'expense',
      category: 'idempotency-duplicate-test',
      description: 'Testing duplicates',
      date: '2026-04-02',
    };

    // First request — should create
    const first = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(first.status).toBe(201);
    const firstId = first.body.data.id;

    // Second request with SAME key — should return cached
    const second = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(firstId); // Same record, not a new one
  });

  it('should create separate records with different idempotency keys', async () => {
    const payload = {
      amount: '3333.0000',
      type: 'income',
      category: 'idempotency-diff-keys',
      date: '2026-04-03',
    };

    const first = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', uuidv4())
      .send(payload);

    const second = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', uuidv4())
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).not.toBe(second.body.data.id); // Different records
  });

  it('should still work without idempotency key (optional)', async () => {
    const res = await authRequest(adminToken)
      .post('/api/v1/records')
      .send({
        amount: '1000.0000',
        type: 'income',
        category: 'no-key-test',
        date: '2026-04-04',
      });

    expect(res.status).toBe(201);
  });
});
