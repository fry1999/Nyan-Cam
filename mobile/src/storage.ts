import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { Photo } from './model';
const key = 'nyan.photos.v1';
const folder = new Directory(Paths.document, 'nyan-photos');
export async function loadPhotos(): Promise<Photo[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Không đọc được danh sách ảnh.');
  return value.filter((p): p is Photo => !!p && typeof p.id === 'string' && typeof p.uri === 'string' && typeof p.mood === 'string' && typeof p.createdAt === 'string').filter(p => new File(p.uri).exists);
}
export async function addPhoto(sourceUri: string, mood: string, current: Photo[]): Promise<Photo[]> {
  folder.create({ idempotent: true, intermediates: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const file = new File(photo.uri);
  try { if (file.exists) file.delete(); }
  catch (error) {
    // Keep the gallery index consistent if the filesystem refuses deletion.
    await AsyncStorage.setItem(key, JSON.stringify(current));
    throw error;
  }
  return updated;
}
export async function getServer(): Promise<string> { return await AsyncStorage.getItem('nyan.server') || process.env.EXPO_PUBLIC_API_URL || ''; }
export async function saveServer(value: string) { await AsyncStorage.setItem('nyan.server', value); }
