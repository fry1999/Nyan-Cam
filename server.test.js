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
test('forwards a consented photo to provider and returns text advice', async () => {
  const previous = process.env.NYAN_AI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.NYAN_AI_API_KEY = 'test-only';
  globalThis.fetch = async (url, init) => {
    if (url !== 'https://api.openai.com/v1/responses') return originalFetch(url, init);
    assert.equal(init.headers.Authorization, 'Bearer test-only');
    const payload = JSON.parse(init.body);
    assert.equal(payload.input[0].content[1].image_url, 'data:image/jpeg;base64,YWJj');
    return Response.json({ output: [{ content: [{ type: 'output_text', text: 'Đứng gần cửa sổ hơn nhé.' }] }] });
  };
  try {
    const response = await originalFetch(base + '/api/coach', { method: 'POST', body: JSON.stringify({ image: 'data:image/jpeg;base64,YWJj', style: 'Cà phê' }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { advice: 'Đứng gần cửa sổ hơn nhé.' });
  } finally { globalThis.fetch = originalFetch; if (previous) process.env.NYAN_AI_API_KEY = previous; else delete process.env.NYAN_AI_API_KEY; }
});
