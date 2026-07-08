# Lightsail デプロイ・起動整備ガイド

techno-drone-system を AWS Lightsail 上で稼働させるための手順書。

- 対象インスタンス: `drone-school-server` (東京リージョン / Ubuntu / **512MB RAM**, 2 vCPUs, 20GB SSD)
- 静的IP: `57.181.4.59` (`drone-school-ip` としてアタッチ済み)
- ドメイン: `techno-drone-system.com` (DNS は Xserver ドメイン管理、apex/www ともに設定済み)

## 全体像

```
利用者のブラウザ
   │  https://techno-drone-system.com (443番ポート)
   ▼
[nginx] ← 玄関の受付係。HTTPS(暗号化)を担当し、来た人を奥へ取り次ぐ
   │  http://localhost:3000 (サーバー内部だけの通路)
   ▼
[Next.jsアプリ] ← 本体。pm2 という「見守り役」が24時間監視して動かし続ける
   │
   ├─ [PostgreSQL] ← 導入済み (DB名: drone_school)
   └─ [ローカルSSD] ← 動画 /home/ubuntu/videos/、アップロード /home/ubuntu/uploads/
```

| 役割 | 名前 | 一言でいうと |
|---|---|---|
| 玄関・鍵 | nginx + Let's Encrypt | HTTPS で受けてアプリに取り次ぐ |
| 本体 | Next.js アプリ | このリポジトリのコード |
| 見守り役 | pm2 | クラッシュ時の自動再起動・サーバー再起動時の自動起動・ログ管理 |
| 保管庫 | PostgreSQL | データ保存 (導入済み) |

---

## STEP 0: Lightsail コンソールでの事前確認

> 2026-07-05 時点で 0-1〜0-3 は確認済み。残作業は 0-4 のスナップショット作成のみ。

### 0-1. 静的IP — ✅ 確認済み

インスタンス詳細 →「Networking」タブで、`drone-school-ip` という静的IPがアタッチ済みであることを確認した。
**デタッチや付け替えは行わないこと。** IP が変わると DIPS 検証環境の IP 許可 (57.181.4.59) と DNS が両方壊れる。

### 0-2. ファイアウォール — ✅ 確認済み

「Networking」タブの IPv4 / IPv6 Firewall とも以下の3ルールが設定済み。

| Application | Port | 状態 |
|---|---|---|
| SSH | 22 | ✅ |
| HTTP | 80 | ✅ |
| HTTPS | 443 | ✅ |

**3000番ポートは開けない。** アプリへは必ず nginx 経由 (443) でアクセスさせる。

### 0-3. DNS — ✅ 確認済み

`techno-drone-system.com` / `www.techno-drone-system.com` とも `57.181.4.59` に解決される (ネームサーバー: xdomain.ne.jp)。作業不要。

### 0-4. スナップショット (作業前バックアップ)

スナップショットは「画面ごと」ではなく**インスタンス丸ごと1台**のバックアップ。

1. インスタンス詳細 → 「**Snapshots**」タブ
2. Manual snapshots の「**+ Create snapshot**」をクリック
3. 名前は自動入力のままで OK → 作成 (数分〜10分)

万一設定を壊しても、このスナップショットから同じ状態のサーバーを作り直せる。

> 補足: 同タブの「Automatic snapshots」(毎日自動・直近7世代保持) は現在オフ。本番運用開始時にオンを推奨 (保存分の課金が少額増える)。

---

## STEP 1: サーバーに入る

いつもの SSH で OK。Lightsail コンソールからも入れる:
インスタンスカード右上の「⋮」→「Connect」、またはインスタンス詳細「Connect」タブ →「**Connect using SSH**」でブラウザ内ターミナルが開く。

---

## STEP 2: 下ごしらえ (Node.js・スワップ・pm2)

### 2-1. Node.js 22 の確認・インストール

> Node 20 は 2026-04 で EOL (サポート終了) のため、現行 LTS の Node 22 を使う。
> 本サーバーには 2026-07-05 に v22.23.1 をインストール済み。

```bash
node -v   # v22.x なら OK。コマンドがない / 古い場合は以下
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

> `Unmet dependencies` で失敗する場合は apt が壊れた状態なので、先に修復と掃除を行う:
> `sudo apt --fix-broken install` → `sudo apt-get purge -y nodejs npm` →
> `sudo apt-get autoremove --purge -y` → 再度インストール。

### 2-2. スワップ領域の作成 (⚠️ 絶対にスキップしない)

このサーバーは **RAM 512MB**。`next build` はビルド中に 1GB 以上使うことがあり、スワップなしではビルドが `Killed` で強制終了される。スワップ (SSD をメモリの延長として使う仕組み) を 2GB 用意する。

```bash
free -h                      # Swap: 0B なら未設定
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # 再起動後も有効化
free -h                      # Swap: 2.0Gi になれば OK
```

> 512MB だと PostgreSQL + Next.js + nginx の同居はギリギリ。動作が遅すぎる・頻繁に落ちる場合は、
> インスタンス名下の「**Change plan**」リンクからプランアップグレード (1GB 以上) を検討する。
> 静的IPアタッチ済みなので、プラン変更しても IP は変わらない。

### 2-3. pm2 のインストール

```bash
sudo npm install -g pm2
```

> ⚠️ サーバーの環境変数に `NODE_ENV` を**設定しないこと** (`.bashrc` 等に書かない)。
> ビルド時は package.json の `build` スクリプトが自動で `NODE_ENV=production` を設定する。
> 手動設定すると `npm ci` の devDependencies インストールやビルドが壊れる。

---

## STEP 3: コードをサーバーに置く

GitHub のプライベートリポジトリなので、サーバーに「読み取り専用の合鍵」(Deploy Key) を渡す。

```bash
# サーバー上で鍵ペアを作成 (パスフレーズなし)
ssh-keygen -t ed25519 -C "lightsail-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub   # ← この1行をコピー
```

GitHub のブラウザ画面: リポジトリ → **Settings** → **Deploy keys** → **Add deploy key**
→ コピーした内容を貼り付け → **「Allow write access」はチェックしない** (読み取り専用) → 追加。

```bash
cd ~
git clone git@github.com:<オーナー名>/techno-drone-system.git
cd techno-drone-system
git checkout dev
mkdir -p /home/ubuntu/videos /home/ubuntu/uploads
```

**ブランチ方針**: DIPS 検証中は修正→再デプロイを何度も回すため `dev` をデプロイする。
検証完了後に dev → main のリリース PR を出し、以降は `main` 追従に切り替える。

---

## STEP 4: `.env` の作成 (人間の作業)

`~/techno-drone-system/.env` に以下を作成する。Claude Code は `.env` に触れない運用のため、転記はユーザーが行う。

```bash
# 秘密鍵類の生成コマンド (それぞれ実行して出力値を使う)
openssl rand -base64 32   # NEXTAUTH_SECRET / INVITE_TOKEN_SECRET 用 (別々に生成)
openssl rand -hex 32      # DIPS_TOKEN_ENCRYPTION_KEY 用 (64桁hexになる)
```

| 変数名 | 設定する値 | 補足 |
|---|---|---|
| `DATABASE_URL` | `postgresql://ubuntu@localhost/drone_school` | CLAUDE.md 記載の接続先 |
| `NEXTAUTH_URL` | `https://techno-drone-system.com` | ログインが正しく動くために必須 |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` の出力 | セッション署名鍵 |
| `APP_BASE_URL` | `https://techno-drone-system.com` | メール内リンク等の基準URL |
| `INVITE_TOKEN_SECRET` | `openssl rand -base64 32` の出力 (別の値) | 招待リンク署名鍵 |
| `RESEND_API_KEY` | Resend の管理画面から | メール送信 |
| `RESEND_FROM_ADDRESS` | 送信元アドレス | Resend でドメイン認証済みのもの |
| `CERTIFICATE_OUTPUT_DIR` | `/home/ubuntu/uploads/certificates` | 証明書PDF出力先 |
| `EXAMINER_NAME` | 試験実施者名 | 帳票に印字される名前 |
| `SEED_ADMIN_PASSWORD` | 初期管理者のパスワード | seed 実行時のみ使用 |
| `DIPS_ENABLED` | `true` | DIPS 連携の有効化 |
| `DIPS_AUTH_BASE_URL` | `https://www.stg.uafp.dips.mlit.go.jp` | 検証環境・認証系 |
| `DIPS_FPR_API_BASE_URL` | `https://www.stg.uafpi.dips.mlit.go.jp` | 検証環境・飛行計画系 |
| `DIPS_FPA_API_BASE_URL` | `https://www.stg.uafp.dips.mlit.go.jp` | 検証環境・許可承認系 |
| `DIPS_FPL_CLIENT_ID` / `DIPS_FPL_CLIENT_SECRET` | 設定通知書 (R08-DRS-0005 xlsx) の drs-fpl の値 | 転記 |
| `DIPS_REQ_CLIENT_ID` / `DIPS_REQ_CLIENT_SECRET` | 同 drs-req の値 | 転記 |
| `DIPS_REDIRECT_URI` | `https://techno-drone-system.com/redirect` | DIPS 登録値と完全一致必須 |
| `DIPS_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` の出力 | 64桁 hex |

作成後、他ユーザーから読めないようにする:

```bash
chmod 600 ~/techno-drone-system/.env
```

---

## STEP 5: ビルドと初期化

```bash
cd ~/techno-drone-system
npm ci                        # 依存パッケージを lock ファイル通りに正確にインストール
npx prisma migrate deploy     # DB に全マイグレーションを適用 (既存データは消さない)
npx prisma generate           # Prisma クライアント生成
npx prisma db seed            # ★初回のみ。初期管理者などを投入
npm run build                 # 本番用ビルド (512MB + swap なので数分〜十数分かかる)
```

- ローカル用の `migrate dev` ではなく **`migrate deploy`** を使う。deploy は「確定済みのマイグレーションを順に適用するだけ」の安全なコマンド。
- seed で作られる管理者は status が **ACTIVE** であることを確認する (ローカルで一度ハマった落とし穴)。

---

## STEP 6: pm2 でアプリを起動する

```bash
cd ~/techno-drone-system
pm2 start npm --name techno-drone -- start   # 「npm start」を pm2 の管理下で実行
pm2 status                                    # status が online なら OK
curl -I http://localhost:3000                 # HTTP/1.1 200 (または 307) が返れば OK
```

サーバー再起動後も自動で立ち上がるようにする:

```bash
pm2 save        # 今の起動構成を記憶
pm2 startup     # ← 表示された「sudo env PATH=... pm2 startup systemd -u ubuntu ...」を
                #    そのままコピペして実行
```

ログの見方: `pm2 logs techno-drone` (Ctrl+C で抜ける)。エラー調査はまずここ。

---

## STEP 7: nginx (玄関) を立てる

```bash
sudo apt-get install -y nginx
sudo tee /etc/nginx/sites-available/techno-drone-system > /dev/null <<'EOF'
server {
    listen 80;
    server_name techno-drone-system.com www.techno-drone-system.com;

    client_max_body_size 100m;

    location /videos/ {
        alias /home/ubuntu/videos/;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/techno-drone-system /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                    # 「syntax is ok」「test is successful」を確認
sudo systemctl reload nginx
```

この時点で `http://techno-drone-system.com` (https ではなく http) でアプリが見えるはず。

> メモ: `/videos/` は nginx が直接配信する設計 (CLAUDE.md 準拠) だが、この形だと URL を知っていれば誰でも見られる。
> 受講生限定にする必要が出たら `internal` + アプリ経由の認可 (X-Accel-Redirect) に切り替える。

---

## STEP 8: HTTPS 化 (Let's Encrypt・無料)

DIPS のリダイレクト URL が `https://` なので HTTPS 化は必須。

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d techno-drone-system.com -d www.techno-drone-system.com
```

対話で聞かれること:
1. メールアドレス (期限切れ通知用)
2. 利用規約への同意
3. HTTP を HTTPS へリダイレクトするか → **2 の Redirect を推奨**

完了すると certbot が nginx 設定に 443 の設定を自動追記する。証明書は90日で切れるが自動更新が仕込まれる:

```bash
sudo certbot renew --dry-run   # エラーが出なければ自動更新 OK
```

---

## STEP 9: 最終動作確認

1. ブラウザで `https://techno-drone-system.com` → 鍵マーク付きでログイン画面が出る
2. seed 管理者でログイン → 管理画面が表示される
3. `pm2 logs techno-drone` にエラーが出ていない
4. Lightsail の「Metrics」タブで CPU / バーストキャパシティに異常がない

ここまで通れば DIPS 疎通確認 (Phase F) に進める。
画面テストは `docs/screen-test-checklist.md` に沿って実施する。

---

## STEP 10: 今後の更新 (再デプロイ) の手順

コードを更新するたびに、サーバー上でこの5行:

```bash
cd ~/techno-drone-system
git pull
npm ci
npx prisma migrate deploy && npx prisma generate
npm run build && pm2 restart techno-drone
```

---

## 困ったときの早見表

| 症状 | まず見るところ | よくある原因 |
|---|---|---|
| ビルドが途中で死ぬ (`Killed`) | `free -h` | スワップ未設定 (STEP 2-2) |
| ブラウザで 502 Bad Gateway | `pm2 status` | アプリが落ちている → `pm2 logs` |
| ログインが変 (ループ等) | `.env` | `NEXTAUTH_URL` が https の本番 URL になっていない |
| nginx 設定変更が効かない | `sudo nginx -t` | 設定ファイルの文法エラー |
| DIPS で `DipsConfigError` | `pm2 logs` | `.env` の DIPS_* が不足 → 不足キー名がログに出る |
| 全体的に極端に遅い | `free -h` / Metrics | メモリ枯渇 → プランアップグレード検討 (Change plan) |
