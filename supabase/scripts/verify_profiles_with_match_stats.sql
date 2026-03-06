-- profiles_with_match_stats ビューが正しく動作するか検証するスクリプト
-- Supabase Dashboard > SQL Editor で実行するか、supabase db execute で実行

-- 1. ビューが存在し、games_played が返るか確認
SELECT id, name, games_played, wins, losses, draws
FROM public.profiles_with_match_stats
LIMIT 5;

-- 2. completed マッチが存在するか確認
SELECT COUNT(*) AS completed_count FROM public.matches WHERE status = 'completed';

-- 3. PostgREST スキーマキャッシュ更新（ビュー追加後に API で認識されない場合）
SELECT pg_notification_queue_usage();
