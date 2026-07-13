# Pギャザ感想ボード

Web展示会・オンラインイベント向けの、手作り付箋風メッセージボードです。

展示会場にある「付箋に感想を書いて壁に貼る」体験を、ブラウザ上でゆるく再現します。

ログインなしで、ひとこと感想や簡単ならくがきを投稿できます。

## できること

- 感想テキストの付箋投稿
- 感想なし・らくがきのみの投稿
- 小さならくがきキャンバス
- 付箋色の選択（赤・黄・青・緑）
- 絵文字リアクションの選択
- ハート
- 新しい順の付箋表示
- スマホ向け2列表示
- 付箋が増えたときのページ送り
- 投稿者本人による自分の付箋削除
- 管理者モードでの削除
- 管理者向け JSON / CSV エクスポート
- イベント終了後の閲覧専用モード
- Supabase保存
- Supabase未設定時の localStorage プロトタイプ動作

## 技術スタック

- React
- TypeScript
- Vite
- Supabase

## ローカルで動かす

```bash
npm install
npm run dev
```

ブラウザで表示されたローカルURLを開きます。

Supabaseを設定していない場合は、ブラウザのlocalStorageにだけ保存されます。

UIや操作感の確認にはこれで十分です。

## 環境変数

`.env.example` を `.env.local` にコピーして、必要な値を入れます。

```bash
cp .env.example .env.local
```

Windows PowerShellの場合:

```powershell
Copy-Item .env.example .env.local
```

`.env.local` の例:

```env
VITE_READ_ONLY=false
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_ADMIN_PASSWORD=admin
```

### 環境変数の意味

| 名前                            | 用途                                                      |
| ------------------------------- | --------------------------------------------------------- |
| `VITE_READ_ONLY`                | `true` にすると新規投稿・削除などを止めて閲覧専用にします |
| `VITE_SUPABASE_URL`             | SupabaseのProject URL                                     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | SupabaseのPublishable key                                 |
| `VITE_ADMIN_PASSWORD`           | Supabase未接続のローカル確認用管理者パスワード            |

本番でSupabaseを使う場合、管理者パスワードはDB側で照合されます。

`VITE_ADMIN_PASSWORD` は主にSupabase未接続のローカル確認用です。

## Supabaseの準備

### 1. プロジェクトを作る

Supabaseで新しいプロジェクトを作成します。

作成時の設定は、まず以下でOKです。

- Data API: 有効
- 新しいテーブルを自動的に公開する: 無効推奨
- RLS: 有効

### 2. Anonymous sign-insを有効にする

このアプリはユーザーログインなしで使いますが、Supabase上では匿名ユーザーとして保存します。

Supabase Dashboardで以下を有効にしてください。

`Authentication` → `Providers` → `Anonymous sign-ins`

### 3. SQLを実行する

Supabase Dashboardの `SQL Editor` で、以下のSQLを古い順に実行します。

1. [`supabase/migrations/20260629150000_initial_board.sql`](supabase/migrations/20260629150000_initial_board.sql)
2. [`supabase/migrations/20260701000000_add_green_note_color.sql`](supabase/migrations/20260701000000_add_green_note_color.sql)
3. [`supabase/migrations/20260701010000_allow_owners_to_delete_notes.sql`](supabase/migrations/20260701010000_allow_owners_to_delete_notes.sql)
4. [`supabase/migrations/20260702000000_limit_note_posts_to_15_minutes.sql`](supabase/migrations/20260702000000_limit_note_posts_to_15_minutes.sql)
5. [`supabase/migrations/20260702010000_limit_note_text_to_200_characters.sql`](supabase/migrations/20260702010000_limit_note_text_to_200_characters.sql)

マイグレーションSQLは「Supabaseのテーブルやルールを作るためのSQL」です。

GitHubに置いてあるだけでは反映されないので、SupabaseのSQL Editorで実行してください。

### 4. 管理者パスワードを変更する

初期SQLでは管理者パスワードが `admin` になっています。

本番利用前に、SupabaseのSQL Editorで必ず変更してください。

```sql
update private.app_settings
set value = crypt('ここに新しい管理者パスワード', gen_salt('bf'))
where key = 'admin_password_hash';
```

## 管理者モード

公開URLの末尾に `?admin=1` を付けると管理者ログイン画面を開けます。

例:

```text
https://example.com/?admin=1
```

通常画面には管理者リンクを表示していません。

管理者モードでは以下ができます。

- 付箋削除
- JSON / CSV エクスポート

## 投稿制限

荒らし・連投対策として、同じブラウザ/匿名ユーザーからの投稿は15分に1回までです。

- フロント側: localStorageで軽く制限
- Supabase側: DBトリガーで制限

DB側でも制限しているので、画面を更新しても簡単には連投できません。

## 文字数制限

本文は最大200文字です。

感想本文が空でも、らくがきがあれば投稿できます。

## 付箋データを全部消す

テスト投稿を消して初期化したいときは、SupabaseのSQL Editorで以下を実行します。

```sql
begin;

truncate table
  public.sticky_note_likes,
  public.sticky_notes;

do $$
begin
  if to_regclass('private.sticky_note_post_limits') is not null then
    execute 'truncate table private.sticky_note_post_limits';
  end if;
end
$$;

commit;
```

らくがき画像はSupabase Storageの `drawings` バケットに保存されます。

画像も完全に消したい場合は、Supabase DashboardのStorage画面から `drawings` バケット内のファイルを削除してください。

## ビルド

```bash
npm run build
```

ビルド結果は `dist/` に出力されます。

## デプロイ先の例

Viteの静的サイトなので、以下のようなサービスに置けます。

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

本番デプロイ時は、デプロイ先の環境変数にも以下を設定してください。

- `VITE_READ_ONLY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## 閲覧専用モードにする

イベント終了後に投稿を止めたい場合は、デプロイ先の環境変数で以下にします。

```env
VITE_READ_ONLY=true
```

変更後、再デプロイすると閲覧専用になります。

## 開発メモ

整形:

```bash
npm run format
```

整形チェック:

```bash
npm run format:check
```

プレビュー:

```bash
npm run preview
```
