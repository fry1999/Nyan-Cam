export const MOODS = [
  { id: 'coffee', title: 'Cà phê', icon: '☕', subtitle: 'Chút chill mỗi ngày', tip: 'Ngồi nghiêng về cửa sổ, thả lỏng vai và đặt tay lên tách cà phê. Ưu tiên ánh sáng dịu chiếu từ bên cạnh.' },
  { id: 'street', title: 'Dạo phố', icon: '☀', subtitle: 'Tự do & rạng rỡ', tip: 'Chọn nền thoáng, bước chậm và nhìn sang bên. Người chụp lùi lại để khung hình có khoảng thở.' },
  { id: 'muse', title: 'Nàng thơ', icon: '✿', subtitle: 'Dịu dàng một chút', tip: 'Đứng cạnh nguồn sáng dịu, xoay vai nhẹ và thả lỏng bàn tay. Thử nhìn ra xa thay vì nhìn vào máy.' },
  { id: 'outfit', title: 'Outfit', icon: '♧', subtitle: 'Hôm nay mặc đẹp', tip: 'Giữ máy thẳng, lấy đủ từ đầu đến chân và chừa khoảng trống. Bước một chân về trước để tư thế thoải mái.' },
] as const;
export type Photo = { id: string; uri: string; mood: string; createdAt: string };
export type Advice = { text: string; source: 'sample' | 'ai'; photoId?: string };
export const palette = { paper: '#FBF7F2', ink: '#493B36', muted: '#97877C', pink: '#BA7785', blush: '#F2E3E2', line: '#E8DED5', white: '#FFFDFA' };
