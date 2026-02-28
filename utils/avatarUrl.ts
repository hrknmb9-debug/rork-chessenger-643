import { supabase } from './supabaseClient';

const BUCKET = 'avatars';

export function resolveAvatarUrl(raw: string | null | undefined, name?: string): string {
  // Initials fallback — always works, no network dependency
  const initials = name && name.trim().length > 0 ? name.trim() : 'U';
  const fallback =
    'https://ui-avatars.com/api/?name=' +
    encodeURIComponent(initials) +
    '&size=200&background=4F46E5&color=fff&bold=true';

  if (!raw) return fallback;

  // Already a full URL (external or Supabase Storage public URL)
  if (raw.startsWith('http')) return raw;

  // Storage path (e.g. "user-id/avatar.jpg") → getPublicUrl (synchronous, no network call)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(raw);
  return data?.publicUrl || fallback;
}
