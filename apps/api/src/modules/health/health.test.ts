import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

describe('GET /api/health', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;

  beforeAll(async () => {
    testApp = await startTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('antwortet ohne Login mit 200 und {"status":"ok"}', async () => {
    const res = await testApp.get('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
