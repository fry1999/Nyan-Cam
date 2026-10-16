import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Photo } from './model';

const key = 'nyan.photos.v1';
const folder = Platform.OS === 'web' ? null : new Directory(Paths.document, 'nyan-photos');
const dbName = 'nyan-cam';
const storeName = 'photos';

function isPhoto(value: unknown): value is Photo {
  if (!value || typeof value !== 'object') return false;
  const photo = value as Photo;
  return typeof photo.id === 'string' && typeof photo.uri === 'string' && typeof photo.mood === 'string' && typeof photo.createdAt === 'string';
}
async function readIndex(): Promise<Photo[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Không đọc được danh sách ảnh.');
  return value.filter(isPhoto);
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không mở được kho ảnh.'));
  });
}
function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = run(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không đọc được ảnh.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error('Không lưu được ảnh.'));
  }));
}
const getBlob = (id: string) => withStore<Blob | undefined>('readonly', store => store.get(id));
const putBlob = (id: string, blob: Blob) => withStore('readwrite', store => store.put(blob, id));
const deleteBlob = (id: string) => withStore('readwrite', store => store.delete(id));

export async function loadPhotos(): Promise<Photo[]> {
  const photos = await readIndex();
  if (Platform.OS !== 'web') return photos.filter(p => new File(p.uri).exists);
  const kept: Photo[] = [];
  for (const photo of photos) {
    const blob = await getBlob(photo.id);
    if (blob) kept.push({ ...photo, uri: URL.createObjectURL(blob) });
  }
  return kept;
}
export async function addPhoto(sourceUri: string, mood: string, current: Photo[]): Promise<Photo[]> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (Platform.OS === 'web') {
    const response = await fetch(sourceUri);
    if (!response.ok) throw new Error('Không lưu được ảnh.');
    const blob = await response.blob();
    await putBlob(id, blob);
    const photo: Photo = { id, uri: URL.createObjectURL(blob), mood, createdAt: new Date().toISOString() };
    const updated = [photo, ...current];
    try { await AsyncStorage.setItem(key, JSON.stringify(updated)); }
    catch (error) { await deleteBlob(id); URL.revokeObjectURL(photo.uri); throw error; }
    return updated;
  }
  if (!folder) throw new Error('Không lưu được ảnh.');
  folder.create({ idempotent: true, intermediates: true });
  const destination = new File(folder, `${id}.jpg`);
  new File(sourceUri).copy(destination);
  const updated = [{ id, uri: destination.uri, mood, createdAt: new Date().toISOString() }, ...current];
  try { await AsyncStorage.setItem(key, JSON.stringify(updated)); }
  catch (error) { destination.delete(); throw error; }
  return updated;
}
export async function removePhoto(photo: Photo, current: Photo[]): Promise<Photo[]> {
  const updated = current.filter(item => item.id !== photo.id);
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  try {
    if (Platform.OS === 'web') {
      await deleteBlob(photo.id);
      if (photo.uri.startsWith('blob:')) URL.revokeObjectURL(photo.uri);
      return updated;
    }
    const file = new File(photo.uri);
    if (file.exists) file.delete();
  } catch (error) {
    await AsyncStorage.setItem(key, JSON.stringify(current));
    throw error;
  }
  return updated;
}
export async function getServer(): Promise<string> { return await AsyncStorage.getItem('nyan.server') || process.env.EXPO_PUBLIC_API_URL || ''; }
export async function saveServer(value: string) { await AsyncStorage.setItem('nyan.server', value); }
