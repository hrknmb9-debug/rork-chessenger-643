import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

declare global {
  var _supabaseSingleton: SupabaseClient | undefined;
  var _supabaseNoAuthSingleton: SupabaseClient | undefined;
}

const memoryStorage: Record<string, string> = {};
const noopStorage = {
  getItem: (key: string) => { return memoryStorage[key] ?? null; },
  setItem: (key: string, value: string) => { memoryStorage[key] = value; },
  removeItem: (key: string) => { delete memoryStorage[key]; },
};

if (!global._supabaseSingleton) {
  global._supabaseSingleton = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Web: storage未指定でSupabaseがlocalStorageを使う（DevToolsで確認可能）
      // Native: AsyncStorageを明示的に指定
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  console.log('supabaseClient: singleton created, platform=' + Platform.OS);
}

if (!global._supabaseNoAuthSingleton) {
  global._supabaseNoAuthSingleton = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: noopStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
    },
  });
}

export const supabase = global._supabaseSingleton;
export const supabaseNoAuth = global._supabaseNoAuthSingleton;

// NOTE: 自動削除ロジックは意図せず正常トークンを消すため無効化済み
// clearStaleSession は起動時チェックのみ。ストレージ削除は行わない。
export async function clearStaleSession(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.log('clearStaleSession: stale session detected, signing out locally');
        await supabase.auth.signOut({ scope: 'local' });
        // ストレージ削除は行わない（トークン消去ロジックを無効化）
      }
    }
  } catch (e) {
    console.log('clearStaleSession error (non-blocking):', e);
  }
}
