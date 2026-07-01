# Pギャザ感想ボード

Webイベント向けの、手作り付箋風メッセージボードです。

## 現在の機能

- テキスト・絵文字・落書き付き付箋の投稿
- 赤・黄・青の付箋色
- 新着順の固定グリッド表示
- 管理者による付箋の削除
- ハート
- 12枚ごとのページ送り
- スマートフォン向け2列表示
- 閲覧専用モード
- Supabaseへの共有保存（未設定時はlocalStorage）
- 管理者向けJSON／CSVエクスポート
- お絵描きのペン・消しゴム・太さ調整

## Supabaseの準備

1. Supabase Dashboardの `Authentication > Providers > Anonymous` で匿名ログインを有効化します。
2. `supabase/migrations/20260629150000_initial_board.sql` の `CHANGE_THIS_PASSWORD` を管理者パスワードへ置換します。
3. 置換したSQL全体をSupabase DashboardのSQL Editorで実行します。
4. `.env.local` にProject URLとPublishable keyを設定します。

管理者画面は公開URLの末尾に `?admin=1` を付けて開きます。通常画面には管理者入口を表示しません。

## 起動

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## 環境変数

`.env.example` を `.env.local` にコピーして設定します。

```env
VITE_READ_ONLY=false
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Supabase未接続時だけ、ローカル試作用の `VITE_ADMIN_PASSWORD` が使われます。公開環境の管理者パスワードはDB側で照合され、フロントエンドには保存されません。
