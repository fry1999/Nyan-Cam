export function normalizeServer(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('Nhập địa chỉ máy chủ, ví dụ https://api.example.com (không kèm đường dẫn).');
  if (!__DEV__ && url.protocol !== 'https:') throw new Error('Bản phát hành yêu cầu máy chủ HTTPS.');
  return url.origin;
}
async function request(base: string, path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(`${normalizeServer(base)}${path}`, { ...init, signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { throw new Error('Máy chủ không trả về dữ liệu hợp lệ. Kiểm tra địa chỉ backend.'); }
    if (!response.ok) throw new Error(data.error || `Máy chủ báo lỗi ${response.status}.`);
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Kết nối quá lâu. Hãy thử lại.');
    throw error;
  } finally { clearTimeout(timeout); }
}
export async function checkServer(base: string): Promise<boolean> {
  const result = await request(base, '/api/status');
  if (typeof result.ai !== 'boolean') throw new Error('Đây không phải máy chủ Nyan Cam.');
  return result.ai;
}
export async function analyzePhoto(base: string, base64: string, style: string): Promise<string> {
  const result = await request(base, '/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: `data:image/jpeg;base64,${base64}`, style }) });
  if (typeof result.advice !== 'string' || !result.advice.trim()) throw new Error('AI chưa trả về gợi ý.');
  return result.advice;
}
