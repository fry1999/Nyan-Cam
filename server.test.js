import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from './server.js';
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());
test('serves camera UI and scripts', async () => {
  for (const path of ['/', '/app.js', '/style.css']) { const response = await fetch(base + path); assert.equal(response.status, 200); assert.ok((await response.text()).length > 100); }
});
test('reports missing AI honestly and rejects analysis without configuration', async () => {
  const previous = process.env.NYAN_AI_API_KEY; delete process.env.NYAN_AI_API_KEY;
  try { assert.deepEqual(await (await fetch(base + '/api/status')).json(), { ai: false }); assert.equal((await fetch(base + '/api/coach', { method: 'POST', body: '{}' })).status, 503); }
  finally { if (previous) process.env.NYAN_AI_API_KEY = previous; }
});
test('rejects invalid image before calling provider', async () => {
  const previous = process.env.NYAN_AI_API_KEY; process.env.NYAN_AI_API_KEY = 'test-only';
  try { const response = await fetch(base + '/api/coach', { method: 'POST', body: JSON.stringify({ image: 'https://example.com' }) }); assert.equal(response.status, 400); }
  finally { if (previous) process.env.NYAN_AI_API_KEY = previous; else delete process.env.NYAN_AI_API_KEY; }
});
test('does not serve environment files or arbitrary paths', async () => {
  assert.equal((await fetch(base + '/.env')).status, 404);
  assert.equal((await fetch(base + '/server.js')).status, 404);
});
