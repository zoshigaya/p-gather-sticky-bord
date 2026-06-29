# Pギャザ感想ボード

Webイベント向けの、手作り付箋風メッセージボードです。

## 現在の機能

- テキスト・絵文字・落書き付き付箋の投稿
- 赤・黄・青の付箋色
- 自分の付箋のドラッグ移動
- 管理者による全付箋の移動・削除
- ハート
- 12枚ごとのページ送り
- スマートフォン向け2列表示
- 閲覧専用モード
- localStorageへの保存

現在はUI確認用のローカル版です。本番公開時はSupabaseなどへの接続が必要です。

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
VITE_ADMIN_PASSWORD=admin
```

`VITE_ADMIN_PASSWORD` はローカル試作用です。公開環境ではフロントエンドに管理者パスワードを置かず、サーバー側で認証してください。
