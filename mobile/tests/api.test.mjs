import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServer, checkServer, analyzePhoto } from '../src/api.ts';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; globalThis.__DEV__ = true; });
globalThis.__DEV__ = true;
test('validates backend origins and requires HTTPS in release', () => {
  assert.equal(normalizeServer(' http://192.168.1.4:3000/ '), 'http://192.168.1.4:3000');
  for (const url of ['file:///tmp/test', 'https://user:password@example.com', 'https://example.com/api', 'https://example.com?key=secret']) assert.throws(() => normalizeServer(url));
  globalThis.__DEV__ = false;
  assert.throws(() => normalizeServer('http://example.com'));
  assert.equal(normalizeServer('https://example.com/'), 'https://example.com');
});
test('checks backend AI capability without an image upload', async () => {
  globalThis.fetch = async (url, init) => { assert.equal(url, 'https://example.com/api/status'); assert.equal(init.body, undefined); return Response.json({ ai: false }); };
  assert.equal(await checkServer('https://example.com'), false);
  globalThis.fetch = async () => Response.json({ hello: 'world' });
  await assert.rejects(checkServer('https://example.com'), /Nyan Cam/);
});
test('sends photo and mood to backend without provider credentials', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://example.com/api/coach');
    assert.equal(init.method, 'POST'); assert.equal(init.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(init.body), { image: 'data:image/jpeg;base64,YWJj', style: 'Cà phê' });
    return Response.json({ advice: 'Hạ máy một chút.' });
  };
  assert.equal(await analyzePhoto('https://example.com', 'YWJj', 'Cà phê'), 'Hạ máy một chút.');
});
test('surfaces server failures and rejects empty AI advice', async () => {
  globalThis.fetch = async () => Response.json({ error: 'AI chưa cấu hình' }, { status: 503 });
  await assert.rejects(analyzePhoto('https://example.com', 'YWJj', 'Outfit'), /AI chưa cấu hình/);
  globalThis.fetch = async () => Response.json({ advice: '' });
  await assert.rejects(analyzePhoto('https://example.com', 'YWJj', 'Outfit'), /chưa trả về/);
});
