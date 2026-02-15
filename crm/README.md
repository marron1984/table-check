# TableCheck サブCRM

TableCheckを正本としたサブCRM。予約/顧客データを抽出・同期し、顧客統合・タグ・現場アラート・基本レポートを提供する。

## 技術スタック

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** + shadcn/ui風コンポーネント
- **Prisma 5** + SQLite（Turso移行可能）
- **JWT認証** + RBAC

## ローカル起動方法

```bash
cd crm

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集（デフォルトで開発用設定済み）

# DB作成 + Prismaクライアント生成
npx prisma db push

# シードデータ投入（管理者ユーザー、店舗、タグ、デモ顧客）
npm run db:seed

# 開発サーバー起動
npm run dev
# → http://localhost:3000
```

### ログイン情報（開発環境）

| ロール | メール | パスワード |
|--------|--------|------------|
| 管理者 | admin@dhpg.co.jp | admin123 |
| 予約マネージャー | manager@dhpg.co.jp | admin123 |
| フロアスタッフ | staff@dhpg.co.jp | admin123 |
| 閲覧ユーザー | viewer@dhpg.co.jp | admin123 |
| 本部分析 | analyst@dhpg.co.jp | admin123 |

## DB操作

```bash
# スキーマ変更後のマイグレーション
npm run db:migrate

# DBリセット + 再シード
npm run db:reset

# Prisma Studio（GUIでDB確認）
npm run db:studio
```

## Webhook受信（ローカル）

```bash
# ngrokでローカルを公開
ngrok http 3000

# TableCheck管理画面でWebhook URLを設定:
# https://<ngrok-id>.ngrok.io/api/tablecheck/sync
# Headerに x-tablecheck-signature: <TABLECHECK_WEBHOOK_SECRET の値>
```

## バックフィル実行

```bash
# 24ヶ月分のバックフィル
curl -X POST http://localhost:3000/api/jobs/backfill \
  -H "Authorization: Bearer cron_dev_secret" \
  -H "Content-Type: application/json" \
  -d '{"months_back": 24}'

# 同期イベント処理
curl -X POST http://localhost:3000/api/jobs/process-sync \
  -H "Authorization: Bearer cron_dev_secret"
```

## Cron設定例（Vercel Cron）

`vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/jobs/process-sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## 画面一覧

| パス | 説明 | 必要ロール |
|------|------|-----------|
| `/login` | ログイン | - |
| `/dashboard/today` | 当日予約一覧（VIP/アレルギー/ノーショー注意） | 全ロール |
| `/customers` | 顧客検索（名前/電話/メール/タグ） | 全ロール |
| `/customers/[id]` | 顧客360プロファイル | 全ロール |
| `/merge-queue` | 統合候補一覧 | admin, manager |
| `/tags` | タグ定義管理 | admin, manager |
| `/reports/basic` | 基本KPIレポート | admin, analyst |

## API一覧

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/tablecheck/sync` | Webhook受信 |
| POST | `/api/jobs/process-sync` | 同期バッチ処理 |
| POST | `/api/jobs/backfill` | バックフィル実行 |
| GET | `/api/customers/search` | 顧客検索 |
| POST | `/api/customers/[id]/notes` | メモ追加 |
| POST | `/api/customers/[id]/tags` | タグ付与/解除 |
| POST | `/api/merge/[id]/apply` | 統合実行 |
| POST | `/api/merge/[id]/reject` | 統合却下 |
| POST | `/api/auth/login` | ログイン |

## 環境変数

| 変数 | 説明 |
|------|------|
| `DATABASE_URL` | SQLite接続文字列 |
| `APP_URL` | アプリURL |
| `AUTH_SECRET` | JWT署名シークレット |
| `ADMIN_EMAIL` | 初期管理者メール |
| `ADMIN_PASSWORD` | 初期管理者パスワード |
| `TABLECHECK_BASE_URL` | TableCheck API URL |
| `TABLECHECK_API_KEY` | TableCheck APIキー |
| `TABLECHECK_WEBHOOK_SECRET` | Webhook検証シークレット |
| `CRON_SECRET` | Cronジョブ認証トークン |
