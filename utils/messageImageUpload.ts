import { Platform } from 'react-native';
import { supabase } from '@/utils/supabaseClient';

const LOG_TAG = '[MessageImageUpload]';
const MESSAGE_IMAGES_BUCKET = 'message-images';

export type MessageImageUploadResult = { url: string } | { error: string };

/**
 * XHR を使ってローカル URI から Blob を取得する（iOS / Android 専用）。
 *
 * 【なぜ base64ToBlob でなく XHR Blob なのか】
 * base64ToBlob は `atob()` + `Uint8Array` ループが同期処理のため、
 * 2MB 以上の画像で JS スレッドを数秒間ブロックし UI が完全フリーズする。
 * XHR の responseType='blob' を使うと React Native がネイティブスタックで
 * ファイルを読み込み、JS スレッドをブロックしない。
 *
 * 対応 URI: file:// (expo-image-picker の allowsEditing 後の URI)
 */
function readFileAsBlob(fileUri: string, mimeType: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.onload = () => {
      if (xhr.status === 200 && xhr.response) {
        resolve(xhr.response as Blob);
      } else {
        console.warn(LOG_TAG, 'XHR load failed, status=', xhr.status);
        resolve(null);
      }
    };
    xhr.onerror = () => {
      console.warn(LOG_TAG, 'XHR network error for uri=', fileUri?.slice(0, 50));
      resolve(null);
    };
    xhr.open('GET', fileUri);
    // Content-Type ヒントを付与（一部環境で Blob の type が空になるのを防ぐ）
    xhr.setRequestHeader('Accept', mimeType);
    xhr.send();
  });
}

/**
 * ph:// / assets-library:// URI を file:// に変換する（iOS 写真ライブラリ URI 対策）。
 * expo-image-picker が allowsEditing:true の場合は通常 file:// が返るが、
 * 編集なし選択時は ph:// が返る場合があるため念のため変換する。
 */
async function normalizeToCachePath(localUri: string): Promise<string> {
  if (localUri.startsWith('file://')) return localUri;
  try {
    const IM = await import('expo-image-manipulator');
    const fmt = IM.SaveFormat?.JPEG ?? ('jpeg' as unknown as import('expo-image-manipulator').SaveFormat);
    const converted = await IM.manipulateAsync(localUri, [], { compress: 0.85, format: fmt });
    return converted.uri;
  } catch (e) {
    console.warn(LOG_TAG, 'normalizeToCachePath failed:', e);
    return localUri;
  }
}

/**
 * iOS / Android 専用: ローカル URI → Blob 取得（XHR 優先、base64 fallback）
 */
async function getNativeBlob(localUri: string, mimeType: string, base64FromPicker?: string): Promise<Blob | null> {
  // URI を file:// に正規化
  const fileUri = await normalizeToCachePath(localUri);

  // XHR 経由（非同期・ノンブロッキング）
  const blob = await readFileAsBlob(fileUri, mimeType);
  if (blob && blob.size > 0) return blob;

  // フォールバック: base64FromPicker から Blob を生成
  // （XHR が失敗した場合のみ。大きな画像はここを通らないよう XHR を優先する）
  const b64 = base64FromPicker;
  if (b64?.length) {
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes.buffer], { type: mimeType });
    } catch (e) {
      console.warn(LOG_TAG, 'base64 fallback failed:', e);
    }
  }

  // 最終フォールバック: FileSystem.readAsStringAsync → base64 → Blob
  try {
    const FileSystem = await import('expo-file-system');
    const b64fs = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    }).catch(() => null);
    if (b64fs?.length) {
      const binary = atob(b64fs);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes.buffer], { type: mimeType });
    }
  } catch (e) {
    console.warn(LOG_TAG, 'FileSystem fallback failed:', e);
  }

  return null;
}

/**
 * Blob を Supabase Storage にアップロードして公開 URL を返す共通実装。
 *
 * Supabase JS クライアント経由のため Authorization + apikey ヘッダーが自動付加される。
 * 以前使用していた手動 fetch / FileSystem.uploadAsync は:
 *   - apikey ヘッダーが欠落しやすい（400/401 サイレント失敗）
 *   - iOS ネイティブブリッジ越しの ArrayBuffer が不安定
 * のため廃止した。Blob + Supabase JS クライアントが最も信頼性が高い。
 */
async function uploadBlobToStorage(blob: Blob, filePath: string, contentType: string): Promise<MessageImageUploadResult> {
  console.log(LOG_TAG, 'uploading blob size=', blob.size, 'path=', filePath);

  const { error: uploadError } = await supabase.storage
    .from(MESSAGE_IMAGES_BUCKET)
    .upload(filePath, blob, { contentType, cacheControl: '31536000', upsert: false });

  if (uploadError) {
    console.warn(LOG_TAG, 'upload error:', uploadError.message);
    return { error: `アップロードに失敗しました: ${uploadError.message}` };
  }

  const { data } = supabase.storage.from(MESSAGE_IMAGES_BUCKET).getPublicUrl(filePath);
  const publicUrl = (data?.publicUrl ?? '').trim();
  if (!publicUrl) return { error: '公開URLの取得に失敗しました' };

  console.log(LOG_TAG, 'upload success');
  return { url: publicUrl + '?t=' + Date.now() };
}

/**
 * チャット用画像アップロード。
 * iOS: XHR Blob（ノンブロッキング） / Web: fetch Blob → Supabase JS クライアント
 */
export async function uploadMessageImage(
  localUri: string,
  userId: string,
  roomId: string,
  base64FromPicker?: string
): Promise<MessageImageUploadResult> {
  const fileExt = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const filePath = `${userId}/${roomId}/${Date.now()}.${fileExt}`;
  const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

  console.log(LOG_TAG, '[Chat] upload start, platform=', Platform.OS, 'hasBase64=', !!base64FromPicker);

  try {
    let blob: Blob | null = null;

    if (Platform.OS === 'web') {
      const res = await fetch(localUri).catch(() => null);
      if (res?.ok) blob = await res.blob().catch(() => null);
    } else {
      blob = await getNativeBlob(localUri, contentType, base64FromPicker);
    }

    if (!blob || blob.size === 0) {
      return { error: '画像データが取得できませんでした。別の画像をお試しください。' };
    }

    return uploadBlobToStorage(blob, filePath, contentType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(LOG_TAG, '[Chat] upload exception:', msg);
    return { error: `アップロードに失敗しました: ${msg}` };
  }
}

/**
 * タイムライン投稿用画像アップロード。
 * iOS: XHR Blob（ノンブロッキング） / Web: fetch Blob → Supabase JS クライアント
 *
 * 【iOS での問題履歴と解決策】
 * - ArrayBuffer: iOS Hermes ブリッジ越しのシリアライズ不安定 → 廃止
 * - FileSystem.uploadAsync: apikey ヘッダー欠落で 401 → 廃止
 * - base64ToBlob: atob()+ループが同期処理のため大きな画像でUI完全フリーズ → 廃止
 * - 現在: XHR responseType='blob' がネイティブスタックで非同期読み込み → 最も安定
 */
export async function uploadTimelineImage(
  localUri: string,
  userId: string,
  base64FromPicker?: string
): Promise<MessageImageUploadResult> {
  const fileExt = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const filePath = `${userId}/timeline/${Date.now()}.${fileExt}`;
  const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

  console.log(LOG_TAG, '[Timeline] upload start, platform=', Platform.OS, 'uri=', localUri?.slice(0, 50), 'hasBase64=', !!base64FromPicker);

  try {
    let blob: Blob | null = null;

    if (Platform.OS === 'web') {
      const res = await fetch(localUri).catch(() => null);
      if (res?.ok) blob = await res.blob().catch(() => null);
    } else {
      blob = await getNativeBlob(localUri, contentType, base64FromPicker);
    }

    if (!blob || blob.size === 0) {
      console.warn(LOG_TAG, '[Timeline] failed to get blob');
      return { error: '画像データの取得に失敗しました。別の画像をお試しください。' };
    }

    return uploadBlobToStorage(blob, filePath, contentType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(LOG_TAG, '[Timeline] upload exception:', msg);
    return { error: `アップロードに失敗しました: ${msg}` };
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
