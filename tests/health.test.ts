import request from 'supertest';
import app from '../src/app.js';

/**
 * Health & Readiness Probe Tests
 * 
 * Validates that Kubernetes/Docker health probes work correctly.
 */
describe('Health & Readiness Probes', () => {
  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.uptime).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });

    it('should include X-Correlation-ID header', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(res.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should echo back a provided correlation ID', async () => {
      const customId = 'test-correlation-123';
      const res = await request(app)
        .get('/health')
        .set('X-Correlation-ID', customId);

      expect(res.headers['x-correlation-id']).toBe(customId);
    });
  });

  describe('GET /ready', () => {
    it('should return 200 when DB and Redis are connected', async () => {
      const res = await request(app).get('/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database.connected).toBe(true);
      expect(res.body.checks.redis.connected).toBe(true);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
