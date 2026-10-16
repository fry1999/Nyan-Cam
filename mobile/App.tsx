import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, AppState, FlatList, Image, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { addPhoto, getServer, loadPhotos, removePhoto, saveServer } from './src/storage';
import { analyzePhoto, checkServer, normalizeServer } from './src/api';
import { MOODS, palette as c, type Advice, type Photo } from './src/model';
import { s } from './src/styles';

const errorText = (error: unknown) => error instanceof Error ? error.message : 'Có lỗi xảy ra. Hãy thử lại nhé.';
function Button({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && s.dim]}><Text style={[s.buttonText, secondary && { color: c.ink }]}>{label}</Text></Pressable>;
}
const Screens = createContext<{ camera: React.ReactNode; gallery: React.ReactNode } | null>(null);
export function CameraScreen() { return useContext(Screens)?.camera; }
export function GalleryScreen() { return useContext(Screens)?.gallery; }
export default function App({ children }: { children: React.ReactNode }) { return <SafeAreaProvider><NyanCam>{children}</NyanCam></SafeAreaProvider>; }
function NyanCam({ children }: { children: React.ReactNode }) {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const activeRef = useRef(active);
  const mounted = useRef(true);
  const operation = useRef(false);
  const router = useRouter();
  const tab = usePathname() === '/gallery' ? 'gallery' : 'camera';
  const setTab = (value: 'camera' | 'gallery') => router.replace(value === 'camera' ? '/' : '/gallery');
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraKey, setCameraKey] = useState(0);
  const [grid, setGrid] = useState(false);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [moodIndex, setMoodIndex] = useState(0);
  const mood = MOODS[moodIndex];
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photosRef = useRef<Photo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [advice, setAdvice] = useState<Advice>({ text: MOODS[0].tip, source: 'sample' });
  const [status, setStatus] = useState('Một chút hướng dẫn, một tấm thật xinh.');
  const [server, setServer] = useState('');
  const [draftServer, setDraftServer] = useState('');
  const [aiState, setAiState] = useState<'unknown' | 'ready' | 'missing' | 'error'>('unknown');
  const [settings, setSettings] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [exporting, setExporting] = useState(false);
  const updatePhotos = (value: Photo[]) => { photosRef.current = value; setPhotos(value); };

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      activeRef.current = state === 'active'; setActive(state === 'active');
      if (state !== 'active') setReady(false);
      else void refreshPermission().catch(() => setStatus('Chưa cập nhật được quyền camera. Hãy thử mở lại app.'));
    });
    void loadPhotos().then(value => { if (mounted.current) { photosRef.current = value; setPhotos(value); } }).catch(() => {
      if (mounted.current) { setStorageError(true); Alert.alert('Chưa đọc được thư viện', 'Đóng và mở lại app để thử lại. App sẽ không ghi đè danh sách ảnh hiện có.'); }
    }).finally(() => { if (mounted.current) setLoaded(true); });
    void getServer().then(value => { if (mounted.current) { setServer(value); setDraftServer(value); } }).catch(() => setStatus('Chưa đọc được cấu hình máy chủ. Bạn có thể nhập lại trong cài đặt.'));
    return () => { mounted.current = false; activeRef.current = false; subscription.remove(); };
  }, [refreshPermission]);
  useEffect(() => {
    let cancelled = false; setAiState('unknown');
    if (server) void checkServer(server).then(enabled => { if (!cancelled) setAiState(enabled ? 'ready' : 'missing'); }).catch(() => { if (!cancelled) setAiState('error'); });
    return () => { cancelled = true; };
  }, [server]);

  async function capture() {
    if (!ready || operation.current || !loaded || storageError) return;
    operation.current = true; setBusy(true);
    try {
      for (let left = timer; left > 0; left--) {
        setCountdown(left); await new Promise(resolve => setTimeout(resolve, 1000));
        if (!activeRef.current || !mounted.current) throw new Error('Đã hủy chụp khi app chuyển sang nền.');
      }
      setCountdown(0);
      if (!activeRef.current || !camera.current) throw new Error('Camera chưa sẵn sàng.');
      const picture = await camera.current.takePictureAsync({ quality: .9 });
      if (!picture?.uri) throw new Error('Chưa lấy được ảnh. Hãy thử lại.');
      const updated = await addPhoto(picture.uri, mood.title, photosRef.current);
      updatePhotos(updated);
      setStatus('Đã giữ ảnh trong app ♡ Mở thư viện để lưu vào điện thoại.');
    } catch (error) { setStatus(errorText(error)); }
    finally { operation.current = false; if (mounted.current) { setBusy(false); setCountdown(0); } }
  }
  async function runAnalysis(photo: Photo) {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    setStatus('Nyan đang xem ánh sáng và bố cục…');
    try {
      const context = ImageManipulator.manipulate(photo.uri);
      context.resize({ width: 768 });
      const image = await context.renderAsync();
      const resized = await image.saveAsync({ format: SaveFormat.JPEG, compress: .65, base64: true });
      context.release(); image.release();
      if (!resized.base64) throw new Error('Không chuẩn bị được ảnh để gửi.');
      const text = await analyzePhoto(server, resized.base64, photo.mood);
      if (mounted.current) { setAdvice({ text, source: 'ai', photoId: photo.id }); setStatus('AI đang nhận xét ảnh vừa gửi, không theo dõi camera trực tiếp.'); }
    } catch (error) { if (mounted.current) setStatus(errorText(error)); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }
  function askAI() {
    const photo = photos[0];
    if (!photo) { Alert.alert('Chụp một tấm trước nhé', 'AI sẽ phân tích ảnh gần nhất trong thư viện của app.'); return; }
    if (!server) { setSettings(true); return; }
    Alert.alert('Gửi ảnh gần nhất cho AI?', 'Một bản thu nhỏ được gửi qua backend đến OpenAI. Nyan Cam không lưu ảnh trên máy chủ. Việc xử lý phía OpenAI tuân theo chính sách của họ.', [{ text: 'Để sau', style: 'cancel' }, { text: 'Đồng ý gửi', onPress: () => void runAnalysis(photo) }]);
  }
  async function saveSettings() {
    setChecking(true);
    try {
      const base = draftServer.trim() ? normalizeServer(draftServer) : '';
      await saveServer(base); setServer(base); setDraftServer(base);
      if (!base) { setAiState('unknown'); setStatus('Đã tắt kết nối AI. Camera vẫn hoạt động.'); setSettings(false); return; }
      const enabled = await checkServer(base); setAiState(enabled ? 'ready' : 'missing');
      Alert.alert(enabled ? 'AI đã kết nối' : 'Backend đã kết nối', enabled ? 'Chụp ảnh rồi chọn AI xem ảnh vừa chụp.' : 'Máy chủ chưa có NYAN_AI_API_KEY. Hướng dẫn mẫu vẫn sử dụng được.');
      setSettings(false);
    } catch (error) { setAiState('error'); Alert.alert('Chưa kết nối được', `${errorText(error)}\nĐịa chỉ hợp lệ đã nhập vẫn được lưu để thử lại.`); }
    finally { setChecking(false); }
  }
  async function exportPhoto(photo: Photo) {
    if (exporting) return; setExporting(true);
    try {
      const result = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!result.granted) {
        Alert.alert('Cần quyền lưu ảnh', 'Bạn có thể cấp quyền trong cài đặt điện thoại hoặc dùng nút Chia sẻ.', [{ text: 'Đóng', style: 'cancel' }, { text: 'Mở cài đặt', onPress: () => void Linking.openSettings() }]); return;
      }
      await MediaLibrary.Asset.create(photo.uri);
      Alert.alert('Đã lưu ♡', 'Ảnh đã có trong thư viện điện thoại.');
    } catch (error) { Alert.alert('Chưa lưu được ảnh', errorText(error)); }
    finally { setExporting(false); }
  }
  async function sharePhoto(photo: Photo) {
    try { if (!await Sharing.isAvailableAsync()) throw new Error('Thiết bị chưa hỗ trợ chia sẻ.'); await Sharing.shareAsync(photo.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' }); }
    catch (error) { Alert.alert('Chưa chia sẻ được', errorText(error)); }
  }
  function deletePhoto(photo: Photo) {
    Alert.alert('Xóa ảnh khỏi app?', 'Ảnh đã xuất ra thư viện điện thoại sẽ được giữ lại.', [{ text: 'Giữ ảnh', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => {
      if (operation.current) return;
      operation.current = true; setBusy(true);
      void removePhoto(photo, photosRef.current).then(value => { updatePhotos(value); setSelected(null); }).catch(error => Alert.alert('Chưa xóa được', errorText(error))).finally(() => { operation.current = false; setBusy(false); });
    } }]);
  }
  const cameraEnabled = permission?.granted && active && tab === 'camera' && !settings && !selected && !cameraError;
  const cameraScreen = <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>A LITTLE GUIDANCE. A LOT OF YOU.</Text><Text style={s.title}>Khoảnh khắc của bạn.<Text style={s.italic}>{'\n'}Xinh theo cách riêng.</Text></Text>
      <View style={s.cameraFrame}>
        {cameraEnabled ? <CameraView key={`${facing}-${cameraKey}`} ref={camera} style={s.camera} facing={facing} mirror={facing === 'front'} flash={facing === 'back' ? flash : 'off'} mode="picture" onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); setCameraError('Không khởi động được camera. Hãy đóng ứng dụng khác đang dùng camera và thử lại.'); }} /> : <View style={s.placeholder}><Text style={s.cat}>≽ܫ≼</Text><Text style={s.welcome}>Xin chào, nàng thơ.</Text><Text style={s.permissionCopy}>{cameraError || (permission?.granted ? 'Camera tạm dừng khi bạn rời màn hình.' : 'Cho phép camera để bắt đầu.\nẢnh được giữ trên thiết bị của bạn.')}</Text>{!permission?.granted ? <Button label={permission?.canAskAgain === false ? 'Mở cài đặt camera ↗' : 'Cho phép camera ↗'} onPress={() => { if (permission?.canAskAgain === false) void Linking.openSettings(); else void requestPermission().catch(error => setStatus(errorText(error))); }} /> : !!cameraError && <Button label="Thử lại" onPress={() => { setCameraError(''); setCameraKey(value => value + 1); }} />}</View>}
        {cameraEnabled && <View pointerEvents="none" style={s.cameraLabel}><Text style={s.cameraLabelText}>● NYAN CAM</Text><Text style={s.cameraLabelText}>{mood.title.toLocaleUpperCase('vi')}</Text></View>}
        {grid && cameraEnabled && <View pointerEvents="none" style={s.grid}>{[1, 2].map(n => <React.Fragment key={n}><View style={[s.gridVertical, { left: `${n * 100 / 3}%` }]} /><View style={[s.gridHorizontal, { top: `${n * 100 / 3}%` }]} /></React.Fragment>)}</View>}
        {countdown > 0 && <View pointerEvents="none" style={s.countdown}><Text style={s.countdownText}>{countdown}</Text></View>}
      </View>
      <View style={s.tools}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setTimer(value => value === 0 ? 3 : value === 3 ? 5 : 0)} style={s.tool}><Text style={s.toolIcon}>◷</Text><Text style={s.toolText}>{timer ? `${timer} giây` : 'Hẹn giờ'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Bật tắt lưới căn khung" accessibilityState={{ selected: grid }} onPress={() => setGrid(value => !value)} style={s.tool}><Text style={[s.toolIcon, grid && { color: c.pink }]}>▦</Text><Text style={s.toolText}>Căn khung</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy || facing === 'front'} onPress={() => setFlash(value => value === 'off' ? 'on' : value === 'on' ? 'auto' : 'off')} style={[s.tool, facing === 'front' && s.dim]}><Text style={s.toolIcon}>ϟ</Text><Text style={s.toolText}>Flash {flash === 'off' ? 'tắt' : flash === 'on' ? 'bật' : 'auto'}</Text></Pressable>
      </View>
      <View style={s.captureRow}><Pressable accessibilityRole="button" accessibilityLabel="Mở ảnh mới nhất" onPress={() => photos[0] ? setSelected(photos[0]) : setTab('gallery')} style={s.thumbnail}>{photos[0] ? <Image source={{ uri: photos[0].uri }} style={s.thumbImage} /> : <Text style={s.toolIcon}>♡</Text>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh" disabled={!ready || busy || !cameraEnabled || !loaded || storageError} onPress={() => void capture()} style={[s.shutter, (!ready || busy || !cameraEnabled || storageError) && s.dim]}>{busy && !countdown ? <ActivityIndicator color={c.pink} /> : <View style={s.shutterInner} />}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="Đổi camera trước sau" disabled={busy} onPress={() => { setReady(false); setCameraError(''); setFacing(value => value === 'back' ? 'front' : 'back'); }} style={s.flip}><Text style={s.flipIcon}>↻</Text></Pressable></View>
      <Text accessibilityLiveRegion="polite" style={s.status}>{status}</Text>
      <View style={s.card}><Text style={s.sectionTitle}><Text style={s.number}>01  </Text>Hôm nay bạn muốn…</Text><View style={s.moods}>{MOODS.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: moodIndex === index }} disabled={busy} onPress={() => { setMoodIndex(index); setAdvice({ text: item.tip, source: 'sample' }); }} style={[s.mood, moodIndex === index && s.activeMood]}><Text style={s.moodIcon}>{item.icon}</Text><Text style={s.moodTitle}>{item.title}</Text><Text style={s.moodSubtitle}>{item.subtitle}</Text></Pressable>)}</View></View>
      <View style={[s.card, s.coachCard]}><View style={s.sectionRow}><Text style={s.sectionTitle}><Text style={s.number}>02  </Text>Nyan mách nhỏ</Text><Text style={s.badge}>{advice.source === 'ai' ? 'AI · ẢNH ĐÃ GỬI' : 'GỢI Ý MẪU'}</Text></View><View style={s.adviceRow}><Text style={s.avatar}>≽ܫ≼</Text><Text style={s.advice}>{advice.text}</Text></View>{advice.source === 'ai' && <Text style={s.note}>Ảnh lúc {new Date(photos.find(p => p.id === advice.photoId)?.createdAt || Number(advice.photoId?.split('-')[0])).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · Không phân tích camera trực tiếp.</Text>}<Button label={busy ? 'Đang xử lý…' : '✧ AI xem ảnh vừa chụp'} disabled={busy || !loaded} secondary onPress={askAI} /><Text style={s.note}>{!server ? 'Chưa cấu hình backend. Mở ⚙ để kết nối AI.' : aiState === 'ready' ? 'AI sẵn sàng · Chỉ gửi ảnh sau khi bạn đồng ý.' : aiState === 'missing' ? 'Backend chưa có khóa AI. Gợi ý trên là nội dung mẫu.' : aiState === 'error' ? 'Chưa kết nối được backend. Kiểm tra trong ⚙.' : 'Đang kiểm tra kết nối AI…'}</Text></View>
      <Text style={s.footerNote}>♡  Không cần hoàn hảo. Chỉ cần là bạn.</Text>
    </ScrollView>;
  const galleryScreen = <View style={s.galleryPage}><Text style={s.title}>Điều nhỏ xinh.<Text style={s.italic}>{'\n'}Giữ lại cho mình.</Text></Text><Text style={s.gallerySubtitle}>{photos.length} ảnh trên thiết bị · Không đồng bộ đám mây</Text><FlatList data={photos} keyExtractor={item => item.id} numColumns={2} contentContainerStyle={s.galleryList} columnWrapperStyle={s.galleryColumns} ListEmptyComponent={<Text style={s.empty}>{!loaded ? 'Đang mở thư viện…' : storageError ? 'Chưa đọc được ảnh. Hãy khởi động lại app.' : 'Chưa có ảnh nào. Sang Camera để chụp tấm đầu tiên nhé ♡'}</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Xem ảnh ${item.mood}`} style={s.galleryItem} onPress={() => setSelected(item)}><Image source={{ uri: item.uri }} style={s.galleryImage} /><Text style={s.galleryCaption}>{item.mood} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}</Text></Pressable>} /></View>;
  return <Screens.Provider value={{ camera: cameraScreen, gallery: galleryScreen }}><SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
    <StatusBar style="dark" />
    <View style={s.header}><View><Text style={s.logo}>≽ܫ≼  nyan<Text style={{ color: c.pink }}>cam</Text></Text><Text style={s.tagline}>YOUR LITTLE PHOTO COMPANION</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cài đặt và quyền riêng tư" onPress={() => { setDraftServer(server); setSettings(true); }} style={s.settingsButton}><Text style={s.settingsIcon}>⚙</Text></Pressable></View>
    {children}
    <SafeAreaView edges={['bottom']} style={s.bottom}><View style={s.tabs}>{(['camera', 'gallery'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} disabled={busy} onPress={() => { if (tab !== item) { setReady(false); setTab(item); } }} style={s.tab}><Text style={[s.tabText, tab === item && s.tabActive]}>{item === 'camera' ? '◎  Camera' : `▧  Thư viện (${photos.length})`}</Text></Pressable>)}</View></SafeAreaView>
    <Modal visible={settings} animationType="slide" onRequestClose={() => { if (!checking) setSettings(false); }}><SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled"><Text style={s.modalTitle}>Một chút cài đặt ♡</Text><Text style={s.sectionTitle}>Kết nối trợ lý AI</Text><Text style={s.paragraph}>Nhập địa chỉ backend Nyan Cam. Khóa OpenAI chỉ đặt ở máy chủ, không nhập vào app.</Text><TextInput accessibilityLabel="Địa chỉ backend" style={s.input} placeholder="https://api.example.com" placeholderTextColor={c.muted} value={draftServer} onChangeText={setDraftServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!checking} /><Text style={s.note}>Khi chạy cục bộ: dùng IP LAN của máy chạy backend, cùng Wi-Fi với điện thoại. localhost trên điện thoại là chính điện thoại đó. Để trống để tắt AI.</Text><Button label={checking ? 'Đang kiểm tra…' : 'Lưu & kiểm tra kết nối'} onPress={() => void saveSettings()} disabled={checking} /><Text style={[s.sectionTitle, { marginTop: 30 }]}>Ảnh của bạn, lựa chọn của bạn</Text><Text style={s.paragraph}>Camera, ảnh gốc và gợi ý mẫu chạy trên thiết bị. Ảnh được giữ trong vùng lưu trữ của app, có thể mất khi gỡ app. Chọn “Lưu vào thư viện” để giữ ảnh bên ngoài app.</Text><Text style={s.paragraph}>Chỉ khi bạn bấm AI và xác nhận, một bản thu nhỏ của ảnh gần nhất được gửi đến backend rồi OpenAI. Backend không ghi ảnh ra đĩa. Việc lưu giữ dữ liệu phía OpenAI tuân theo chính sách của họ.</Text><Text style={s.paragraph}>Bản MVP chưa có bộ lọc native, làm đẹp, tự chọn ảnh đẹp hoặc theo dõi tư thế trực tiếp. Chụp ảnh và thư viện dùng được khi không có AI.</Text><Button label="Quay lại camera" secondary disabled={checking} onPress={() => setSettings(false)} /></ScrollView></SafeAreaView></Modal>
    <Modal visible={!!selected} animationType="slide" onRequestClose={() => { if (!exporting && !busy) setSelected(null); }}><SafeAreaView style={s.root}>{selected && <><View style={s.detailHeader}><Text style={s.sectionTitle}>{selected.mood}</Text><Pressable accessibilityRole="button" disabled={exporting || busy} onPress={() => setSelected(null)}><Text style={s.close}>Đóng ✕</Text></Pressable></View><Image source={{ uri: selected.uri }} resizeMode="contain" style={s.detailImage} /><View style={s.detailActions}><Button label={exporting ? 'Đang lưu…' : '↓ Lưu vào thư viện'} disabled={exporting || busy} onPress={() => void exportPhoto(selected)} /><Button label="Chia sẻ ♡" secondary disabled={exporting || busy} onPress={() => void sharePhoto(selected)} /><Pressable accessibilityRole="button" disabled={exporting || busy} onPress={() => deletePhoto(selected)} style={s.delete}><Text style={{ color: c.pink }}>Xóa khỏi app</Text></Pressable></View></>}</SafeAreaView></Modal>
  </SafeAreaView></Screens.Provider>;
}
