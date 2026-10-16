const $ = id => document.getElementById(id);
let stream, facing = 'user', filter = 'none', mood = 'Cà phê', timer = 0, aiReady = false, capturing = false, analyzing = false;
const photos = [];
const tips = {
  'Cà phê': 'Ngồi nghiêng nhẹ về phía cửa sổ, đặt tay lên tách cà phê. Để ánh sáng tự nhiên kể câu chuyện của bạn nhé.',
  'Dạo phố': 'Chọn một khoảng nền thoáng, bước chậm và nhìn sang bên. Người chụp lùi lại để khung hình có thêm không gian nhé.',
  'Nàng thơ': 'Đứng cạnh nguồn sáng dịu, xoay vai nhẹ và thả lỏng bàn tay. Thử nhìn ra xa thay vì nhìn thẳng vào máy.',
  'Outfit': 'Giữ máy thẳng, chụp đủ từ đầu đến chân và chừa một chút khoảng trống. Bước một chân về trước cho tư thế thoải mái.'
};
function message(text) { $('camera-message').textContent = text; }
function updateAI() { $('ask-ai').disabled = !stream || !aiReady || analyzing; }
async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { message('Camera cần HTTPS hoặc localhost và trình duyệt hỗ trợ camera.'); return; }
  $('enable-camera').disabled = true;
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 } } });
    $('video').srcObject = stream;
    await $('video').play();
    $('video').style.display = 'block';
    document.querySelector('.demo-scene').hidden = true;
    $('video').style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
    $('camera-welcome').hidden = true;
    $('camera-state').textContent = '● CAMERA ĐANG BẬT';
    $('shutter').disabled = false;
    message('Sẵn sàng rồi. Chọn mood và lưu lại khoảnh khắc nhé.');
  } catch {
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    $('video').style.display = 'none'; $('camera-welcome').hidden = false;
    document.querySelector('.demo-scene').hidden = false;
    $('camera-state').textContent = '● KHUNG HÌNH MẪU'; $('shutter').disabled = true;
    message('Không mở được camera. Kiểm tra quyền truy cập hoặc thử camera khác.');
  } finally { $('enable-camera').disabled = false; updateAI(); }
}
function frame(maxWidth = 1600, applyFilter = true) {
  const video = $('video');
  if (!stream || video.readyState < 2 || !video.videoWidth) throw new Error('Camera chưa sẵn sàng.');
  // Crop to the same aspect ratio shown in the viewfinder, rather than exporting hidden edges.
  const ratio = $('viewfinder').clientWidth / $('viewfinder').clientHeight;
  let sw = video.videoWidth, sh = video.videoHeight;
  if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(Math.min(sw, maxWidth)); canvas.height = Math.round(canvas.width / ratio);
  const ctx = canvas.getContext('2d');
  if (applyFilter) ctx.filter = filter;
  if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}
$('enable-camera').onclick = openCamera;
$('flip').onclick = async () => { if (capturing || analyzing) return; facing = facing === 'user' ? 'environment' : 'user'; await openCamera(); };
$('timer').onclick = () => { timer = timer === 0 ? 3 : timer === 3 ? 5 : 0; $('timer-label').textContent = timer ? `${timer}s` : 'Tắt'; };
$('grid').onclick = () => { $('grid-lines').hidden = !$('grid-lines').hidden; $('grid').setAttribute('aria-pressed', String(!$('grid-lines').hidden)); };
$('moods').onclick = event => {
  const button = event.target.closest('[data-mood]'); if (!button) return;
  mood = button.dataset.mood;
  document.querySelectorAll('.mood').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
  $('advice').textContent = tips[mood]; $('advice-source').textContent = `Gợi ý tạo dáng mẫu · ${mood}`;
};
$('filters').onclick = event => {
  const button = event.target.closest('[data-filter]'); if (!button) return;
  filter = button.dataset.filter; $('video').style.filter = filter; document.querySelector('.demo-scene').style.filter = filter;
  document.querySelectorAll('.filter').forEach((item, index) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); if (active) $('filter-label').textContent = `0${index + 1} / ${button.dataset.label.toLocaleUpperCase('vi')}`; });
};
$('shutter').onclick = async () => {
  if (capturing || !stream) return; capturing = true; $('shutter').disabled = true;
  try {
    for (let remaining = timer; remaining > 0; remaining--) { $('countdown').textContent = remaining; await new Promise(resolve => setTimeout(resolve, 1000)); }
    $('countdown').textContent = '';
    const canvas = frame();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
    if (!blob) throw new Error('Không tạo được ảnh.');
    const url = URL.createObjectURL(blob); photos.unshift(url);
    if (photos.length > 12) URL.revokeObjectURL(photos.pop());
    $('gallery').replaceChildren();
    photos.forEach((src, index) => { const figure = document.createElement('figure'); figure.className = 'photo'; const img = document.createElement('img'); img.src = src; img.alt = `Khoảnh khắc ${photos.length - index}`; const a = document.createElement('a'); a.href = src; a.download = `nyan-${Date.now()}-${index}.jpg`; a.textContent = '↓ Lưu ảnh'; figure.append(img, a); $('gallery').append(figure); });
    $('photo-count').textContent = `(${photos.length})`;
    $('viewfinder').classList.remove('flash'); void $('viewfinder').offsetWidth; $('viewfinder').classList.add('flash');
    message('Đã chụp ♡ Tải ảnh ở bên dưới để giữ lại. Tối đa 12 ảnh gần nhất trong phiên.');
  } catch (error) { message(error.message); }
  finally { capturing = false; $('countdown').textContent = ''; $('shutter').disabled = !stream; }
};
$('ask-ai').onclick = async () => {
  if (analyzing || !aiReady || !stream) return;
  if (!window.confirm('Gửi một khung hình hiện tại đến OpenAI để nhận gợi ý? Ảnh không được lưu trên máy chủ Nyan Cam.')) return;
  analyzing = true; updateAI(); $('ai-note').textContent = 'Nyan đang xem ánh sáng và bố cục…';
  try {
    const image = frame(768, false).toDataURL('image/jpeg', .7);
    const response = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, style: mood }), signal: AbortSignal.timeout(35000) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    $('advice').textContent = result.advice; $('advice-source').textContent = 'AI phân tích khung hình vừa gửi';
    $('ai-note').textContent = 'Gợi ý cho ảnh vừa gửi; bấm lại khi bạn đổi góc chụp.';
  } catch (error) { $('ai-note').textContent = error.name === 'TimeoutError' ? 'AI phản hồi chậm. Thử lại sau nhé.' : error.message || 'Chưa kết nối được AI.'; }
  finally { analyzing = false; updateAI(); }
};
$('privacy').onclick = () => $('privacy-dialog').showModal();
fetch('/api/status').then(response => response.json()).then(status => { aiReady = status.ai; $('ai-badge').textContent = aiReady ? 'AI SẴN SÀNG' : 'HƯỚNG DẪN MẪU'; if (aiReady) $('ai-note').textContent = 'Chỉ gửi một khung hình khi bạn bấm và đồng ý.'; updateAI(); }).catch(() => { $('ai-note').textContent = 'Không kiểm tra được kết nối AI. Bạn vẫn có thể chụp ảnh.'; });
window.addEventListener('pagehide', () => { stream?.getTracks().forEach(track => track.stop()); photos.forEach(url => URL.revokeObjectURL(url)); });
