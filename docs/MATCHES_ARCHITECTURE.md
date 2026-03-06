# matches テーブル アーキテクチャ調査

## 1. matches の紐付き先（依存関係マップ）

```
matches (中核テーブル)
├── profiles (FK: requester_id, opponent_id, winner_id)
│   └── profiles.games_played, wins, losses, draws ← トリガーで同期
├── match_ratings (FK: match_id → matches.id)
├── match_result_reports (FK: match_id → matches.id, opponent_id → profiles.id)
├── profiles_with_match_stats (ビュー) ← matches を集計して表示
│   └── get_profile_match_stats(uuid) ← SECURITY DEFINER 関数
└── notifications (match 関連の通知タイプ)
```

## 2. matches を参照するもの一覧

| 参照元 | 種類 | 用途 | 干渉リスク |
|--------|------|------|------------|
| **profiles** | トリガー更新 | status=completed 時に games_played 等を同期 | トリガーと profiles の二重管理で不整合の可能性 |
| **profiles_with_match_stats** | ビュー | 表示用に matches を正とする集計 | ビューが matches を直接読むと RLS で 0 になる |
| **get_profile_match_stats** | 関数 | ビュー用に RLS バイパスで集計 | SECURITY DEFINER が必要 |
| **match_ratings** | 子テーブル | マッチ評価 | match 削除時に CASCADE 等 |
| **match_result_reports** | 子テーブル | 結果報告 | 同上 |
| **ChessProvider** | クライアント | .from('matches') で CRUD | RLS で当事者のみ |
| **delete-user** | Edge Function | ユーザー削除時に matches 削除 | service_role で RLS バイパス |

## 3. 干渉しやすいポイント（根本原因）

### 3.1 RLS とビューの干渉（解明済み）

```
matches RLS: 「当事者のみ読める」
  USING: auth.uid() = requester_id OR auth.uid() = opponent_id

→ 他プレイヤーのマッチは見えない
→ ビューが matches を直接 LATERAL JOIN すると、他プレイヤー分は常に 0
→ 対策: get_profile_match_stats (SECURITY DEFINER) で集計
```

### 3.2 profiles と matches の二重管理

```
profiles.games_played  ← トリガー (sync_profiles_on_match_completed) で更新
                ↑
matches.status = 'completed' のとき

問題: トリガーが失敗・遅延・バックフィル漏れがあると不整合
対策: profiles_with_match_stats は matches を正とする（profiles の値を使わない）
```

### 3.3 SECURITY DEFINER ビュー（Linter 0010）

```
PostgreSQL のデフォルト: ビューは SECURITY DEFINER（作成者権限で実行）
→ ビューが RLS をバイパスし、意図しないデータ露出のリスク
→ 対策: CREATE VIEW ... WITH (security_invoker=on)
```

**重要**: ビューに `security_invoker=on` を付けても、ビュー内で呼ぶ `get_profile_match_stats` は SECURITY DEFINER のまま。関数は「呼び出し元の権限」に依存せず、関数所有者の権限で matches を読む。よって他プレイヤーのマッチ数表示は維持される。

### 3.4 依存関係の流れ（データフロー）

```
1. マッチ作成: INSERT matches (requester_id, opponent_id)
   → matches_insert_requester RLS

2. マッチ承諾/辞退: UPDATE matches SET status
   → matches: 当事者のみ更新できる RLS

3. マッチ完了: UPDATE matches SET status='completed', winner_id, result
   → トリガー on_match_completed_sync_profiles
   → profiles の games_played, wins, losses, draws を両者分更新

4. 表示: SELECT FROM profiles_with_match_stats
   → profiles を読む（RLS: 全員可）
   → get_profile_match_stats(p.id) を呼ぶ（SECURITY DEFINER → matches 全件参照可）
   → games_played, wins, losses, draws を返す
```

## 4. 表記されない可能性の潰し方（検証手順）

### 4.1 PostgREST スキーマキャッシュ

マイグレーション適用後、ビューが API に認識されない場合がある。Supabase Dashboard → SQL Editor で実行:

```sql
SELECT pg_notification_queue_usage();
```

### 4.2 ビュー動作確認

```sql
SELECT id, name, games_played, wins, losses, draws
FROM profiles_with_match_stats
LIMIT 5;
```

### 4.3 matches の status 確認

集計対象は `status = 'completed'` のみ。大文字・全角等に注意:

```sql
SELECT DISTINCT status FROM matches;
```

### 4.4 クライアント側デバッグ

- コンソールに `[Home] profiles_with_match_stats error:` や `[ChessProvider] ... profiles_with_match_stats failed:` が出たら API エラー
- `PGRST116` 等はビュー未認識の可能性 → 4.1 を実行

---

## 5. まとめ：根本の干渉構造

| 干渉 | 原因 | 対策 |
|------|------|------|
| 他プレイヤー 0 表示 | matches RLS がビューに適用される | get_profile_match_stats (SECURITY DEFINER) |
| Linter 0010 | ビューがデフォルトで SECURITY DEFINER | ビューに security_invoker=on |
| profiles 不整合 | トリガーと手動更新の二重管理 | 表示は matches を正とするビューに統一 |
