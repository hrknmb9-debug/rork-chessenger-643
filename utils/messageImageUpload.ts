import { Platform } from 'react-native';
import { supabase } from '@/utils/supabaseClient';

const LOG_TAG = '[MessageImageUpload]';
const MESSAGE_IMAGES_BUCKET = 'message-images';

/**
 * iOS ネイティブアップローダー: expo-file-system の uploadAsync を使用。
 * React Native の fetch + ArrayBuffer はブリッジ経由のため iOS で不安定になる場合がある。
 * uploadAsync は iOS/Android のネイティブ HTTP スタックを直接使うため確実に動作する。
 *
 * 対応 URI: file:// / ph:// / assets-library:// など iOS ネイティブ URI 全般
 */
async function uploadViaFileSystem(
  localUri: string,
  uploadUrl: string,
  token: string,
  contentType: string
): Promise<{ ok: boolean; status: number; body: string }> {
  const FileSystem = await import('expo-file-system');

  // ph:// や assets-library:// は file:// に変換してから uploadAsync に渡す
  let fileUri = localUri;
  if (!localUri.startsWith('file://')) {
    const ImageManipulator = await import('expo-image-manipulator');
    const fmt = ImageManipulator.SaveFormat?.JPEG ?? ('jpeg' as unknown as import('expo-image-manipulator').SaveFormat);
    const converted = await ImageManipulator.manipulateAsync(localUri, [], {
      compress: 0.85,
      format: fmt,
    });
    fileUri = converted.uri;
  }

  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
  });

  return { ok: result.status >= 200 && result.status < 300, status: result.status, body: result.body };
}

/** base64 を ArrayBuffer に変換（Web / Hermes 両対応） */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    if (typeof atob !== 'undefined') {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
  } catch {
    // フォールバックへ
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const stripped = base64.replace(/=+$/, '');
  const len = stripped.length;
  const byteLen = (len * 3) >> 2;
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[stripped.charCodeAt(i)] ?? 0;
    const b = lookup[stripped.charCodeAt(i + 1)] ?? 0;
    const c = lookup[stripped.charCodeAt(i + 2)] ?? 0;
    const d = lookup[stripped.charCodeAt(i + 3)] ?? 0;
    bytes[p++] = (a << 2) | (b >> 4);
    if (p < byteLen) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < byteLen) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.buffer;
}

export type MessageImageUploadResult = { url: string } | { error: string };

/** 認証トークン + Supabase URL を取得するユーティリティ */
async function getUploadPrereqs(): Promise<{ token: string; supabaseUrl: string } | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return null;
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  if (!supabaseUrl) return null;
  return { token, supabaseUrl };
}

/** Supabase Storage の公開 URL を構築して返す */
function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from(MESSAGE_IMAGES_BUCKET).getPublicUrl(filePath);
  return (data?.publicUrl ?? '').trim();
}

/**
 * チャット用画像アップロード。
 * iOS では FileSystem.uploadAsync（ネイティブ HTTP）を優先し、
 * 失敗時に base64 → fetch へフォールバックする。
 */
export async function uploadMessageImage(
  localUri: string,
  userId: string,
  roomId: string,
  base64FromPicker?: string
): Promise<MessageImageUploadResult> {
  const prereqs = await getUploadPrereqs();
  if (!prereqs) return { error: '認証セッションが取得できませんでした。再ログインしてください。' };
  const { token, supabaseUrl } = prereqs;

  const fileExt = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const filePath = `${userId}/${roomId}/${Date.now()}.${fileExt}`;
  const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${MESSAGE_IMAGES_BUCKET}/${filePath}`;

  // iOS / Android: FileSystem.uploadAsync（ネイティブ HTTP, file:// も ph:// も対応）
  if (Platform.OS !== 'web') {
    try {
      const result = await uploadViaFileSystem(localUri, uploadUrl, token, contentType);
      if (result.ok) {
        const publicUrl = getPublicUrl(filePath);
        if (publicUrl) return { url: publicUrl + '?t=' + Date.now() };
      }
      console.warn(LOG_TAG, '[Chat] FileSystem upload failed:', result.status, result.body);
    } catch (e) {
      console.warn(LOG_TAG, '[Chat] FileSystem upload exception:', e);
    }
  }

  // フォールバック: Web または FileSystem 失敗時 → base64 → ArrayBuffer → fetch
  let arrayBuffer: ArrayBuffer | null = null;
  if (Platform.OS === 'web') {
    const res = await fetch(localUri).catch(() => null);
    if (res?.ok) arrayBuffer = await res.arrayBuffer().catch(() => null);
  } else if (base64FromPicker?.length) {
    arrayBuffer = base64ToArrayBuffer(base64FromPicker);
  }

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return { error: '画像データが取得できませんでした。別の画像をお試しください。' };
  }

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType, 'x-upsert': 'false' },
      body: arrayBuffer,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { error: `アップロードに失敗しました (${response.status}): ${errText}` };
    }
    const publicUrl = getPublicUrl(filePath);
    if (!publicUrl) return { error: '公開URLの取得に失敗しました' };
    return { url: publicUrl + '?t=' + Date.now() };
  } catch (e) {
    return { error: `アップロードに失敗しました: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * タイムライン投稿用画像アップロード。
 * iOS では FileSystem.uploadAsync（ネイティブ HTTP）を優先し、
 * 失敗時に base64 → fetch へフォールバックする。
 */
export async function uploadTimelineImage(
  localUri: string,
  userId: string,
  base64FromPicker?: string
): Promise<MessageImageUploadResult> {
  const prereqs = await getUploadPrereqs();
  if (!prereqs) return { error: '認証セッションが取得できませんでした。再ログインしてください。' };
  const { token, supabaseUrl } = prereqs;

  const fileExt = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const filePath = `${userId}/timeline/${Date.now()}.${fileExt}`;
  const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${MESSAGE_IMAGES_BUCKET}/${filePath}`;

  console.log(LOG_TAG, '[Timeline] upload start, uri=', localUri?.slice(0, 40), 'hasBase64=', !!base64FromPicker);

  // iOS / Android: FileSystem.uploadAsync（ネイティブ HTTP, file:// も ph:// も対応）
  if (Platform.OS !== 'web') {
    try {
      const result = await uploadViaFileSystem(localUri, uploadUrl, token, contentType);
      if (result.ok) {
        const publicUrl = getPublicUrl(filePath);
        if (publicUrl) {
          console.log(LOG_TAG, '[Timeline] FileSystem upload success');
          return { url: publicUrl + '?t=' + Date.now() };
        }
      }
      console.warn(LOG_TAG, '[Timeline] FileSystem upload failed:', result.status, result.body);
    } catch (e) {
      console.warn(LOG_TAG, '[Timeline] FileSystem upload exception:', e);
    }
  }

  // フォールバック: Web または FileSystem 失敗時 → base64 → ArrayBuffer → fetch
  const arrayBuffer = await (async (): Promise<ArrayBuffer | null> => {
    if (base64FromPicker?.length) return base64ToArrayBuffer(base64FromPicker);
    if (Platform.OS === 'web') {
      const res = await fetch(localUri).catch(() => null);
      return res?.ok ? res.arrayBuffer() : null;
    }
    return null;
  })();

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    console.warn(LOG_TAG, '[Timeline] no image data for fallback');
    return { error: '画像データの取得に失敗しました。別の画像をお試しください。' };
  }

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType, 'x-upsert': 'false' },
      body: arrayBuffer,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(LOG_TAG, '[Timeline] fallback upload failed:', response.status, errText);
      return { error: `アップロードに失敗しました (${response.status}): ${errText}` };
    }
    const publicUrl = getPublicUrl(filePath);
    if (!publicUrl) return { error: '公開URLの取得に失敗しました' };
    console.log(LOG_TAG, '[Timeline] fallback upload success');
    return { url: publicUrl + '?t=' + Date.now() };
  } catch (e) {
    return { error: `アップロードに失敗しました: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const IMG_PREFIX = '__IMG__';

export function encodeImageContent(uri: string): string {
  return IMG_PREFIX + uri;
}

export function decodeMessageContent(content: string): { isImage: boolean; value: string } {
  if (content.startsWith(IMG_PREFIX)) {
    return { isImage: true, value: content.slice(IMG_PREFIX.length) };
  }
  return { isImage: false, value: content };
}

export function isImageMessageContent(text: string | undefined | null): boolean {
  return typeof text === 'string' && text.startsWith(IMG_PREFIX);
}

export function getImageUrlFromContent(text: string): string {
  return text.startsWith(IMG_PREFIX) ? text.slice(IMG_PREFIX.length) : '';
}

/** ブラウザ/WebView で安全に表示できる画像URLか（file:// やローカルパスは false） */
export function isLoadableImageUrl(uri: string | null | undefined): boolean {
  if (!uri || typeof uri !== 'string' || !uri.trim()) return false;
  const u = uri.trim();
  return u.startsWith('http://') || u.startsWith('https://');
}
