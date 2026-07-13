以下の方針で実装してください：

【サーバー構成】
- Lightsail Ubuntu 24.04（1GB RAM / 40GB SSD）1台に全部載せる
- デプロイ先：/home/ubuntu/app

【技術スタック】
- フロントエンド：Next.js 14 (App Router) + TypeScript + Tailwind CSS
- バックエンド：Next.js API Routes（FastAPIは使わない。1プロセスに統合）
- DB：PostgreSQL（サーバー内にインストール済み。DB名: drone_school）
- ORM：Prisma（接続先: postgresql://ubuntu@localhost/drone_school）
- 動画配信：/home/ubuntu/videos/ にMP4を配置し、nginxのlocationで直接配信
- 認証：NextAuth.js（Credentials Provider、DB保存）
- PDF生成：@react-pdf/renderer（Puppeteerは使わない。メモリ1GBなので）
- ファイル保存：ローカルSSD（/home/ubuntu/uploads/）
- メール：Resend（環境変数 RESEND_API_KEY で設定）

【やらないこと】
- Supabase / Railway / PlanetScale 等の外部DBは使わない
- Cloudflare Stream / R2 は使わない
- S3は使わない（将来のスケールアップ時に検討）
- Docker は使わない（メモリ1GBでは重すぎる）

【制約】
- RAM 1GBで動作すること（pm2で起動、スワップ2GB設定済み）
- SSD 40GBに収めること（動画は720pで10GB以内を想定）
- node_modules含めてビルド後のサイズを確認すること