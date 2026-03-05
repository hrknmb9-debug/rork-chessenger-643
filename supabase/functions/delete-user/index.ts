// Supabase Edge Function: アカウント削除
// 認証済みユーザーが自身のアカウントを削除する（Apple App Store 審査対応）

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization' }),
        { status: 401, headers: { ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders } }
      );
    }

    const userId = user.id;

    const db = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ── 依存データを順に削除 ──────────────────────────────────────────────

    // メッセージ（送受信問わず自分が絡む room を消す）
    await db.from('messages').delete().eq('sender_id', userId);

    // マッチ（requester / opponent 両方）
    await db.from('matches').delete().eq('requester_id', userId);
    await db.from('matches').delete().eq('opponent_id', userId);

    // お気に入り（双方向）
    await db.from('player_favorites').delete().eq('user_id', userId);
    await db.from('player_favorites').delete().eq('favorite_player_id', userId);

    // イベント参加
    await db.from('event_participants').delete().eq('user_id', userId);

    // 投稿への いいね / コメント
    await db.from('post_likes').delete().eq('user_id', userId);
    await db.from('comments').delete().eq('user_id', userId);

    // 通知
    await db.from('notifications').delete().eq('user_id', userId);
    await db.from('notifications').delete().eq('related_user_id', userId);

    // 自分の投稿に紐づくサブリソースを消してから投稿本体を削除
    const { data: userPosts } = await db.from('posts').select('id').eq('user_id', userId);
    if (userPosts?.length) {
      const postIds = userPosts.map((p: { id: string }) => p.id);
      await db.from('post_likes').delete().in('post_id', postIds);
      await db.from('comments').delete().in('post_id', postIds);
      const { data: ev } = await db.from('events').select('id').in('post_id', postIds);
      if (ev?.length) {
        const evIds = ev.map((e: { id: string }) => e.id);
        await db.from('event_participants').delete().in('event_id', evIds);
        await db.from('events').delete().in('post_id', postIds);
      }
      await db.from('posts').delete().eq('user_id', userId);
    }

    // プロフィール
    await db.from('profiles').delete().eq('id', userId);

    // ── auth.users から削除 ────────────────────────────────────────────────
    const { error: deleteError } = await supabaseAuth.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('delete-user: admin.deleteUser failed', deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message || 'Failed to delete account' }),
        { status: 500, headers: { ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders } }
    );
  } catch (e) {
    console.error('delete-user: unexpected error', e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders } }
    );
  }
});
