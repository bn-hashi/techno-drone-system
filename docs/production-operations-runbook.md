# 本番運用ランブック（Lightsail / techno-drone-system）

対象サーバー: AWS Lightsail インスタンス `drone-school-server`
接続方法: Lightsail コンソール → インスタンスの「⋮」→「Connect」

作業前提: 各ステップは上から順に実行する。「成功の目印」に一致しない出力が出たら、
自己判断で先に進まず、出力を貼って相談すること。**ただし貼る前に必ずマスキングする**:
`DATABASE_URL`・`NEXTAUTH_*`・`DIPS_*` などの環境変数の値、`Authorization` / `Cookie` ヘッダ、
パスワード、個人情報（氏名・メールアドレス等）が含まれていれば伏せ字にし、生ログのまま貼らない。

---

## STEP 0: サーバーに入る + バックアップ

### 0-1. サーバーに入る

Lightsail コンソールでインスタンス `drone-school-server` のカード右上の「⋮」→「Connect」。
ブラウザ内ターミナルが開き、`ubuntu@ip-...:~$` が表示されれば成功。

### 0-2. 【最重要】作業前にスナップショットを取る

画面操作（コマンドではない）:

1. インスタンス画面 →「Snapshots」タブ
2. 「Manual snapshots」→「+ Create snapshot」
3. 名前はそのまま「Create」（作成に数分〜10分かかる）

成功の目印: 今日の日付のスナップショットが `Available` になる。
`Creating...` の間に進めてよいのは STEP 1-1（読み取りのみの確認）まで。
**STEP 1-2 以降（本番を実際に変更する操作）は `Available` を確認してから開始する**
（作業中に障害が起きた時点では、復元できるスナップショットがまだ存在しないため）。

---

## STEP 1: リリースを本番反映する

### 1-1. 現在地とアプリ状態の確認

```bash
cd ~/techno-drone-system
pwd
git status
pm2 status
```

- `pwd` → `/home/ubuntu/techno-drone-system`
- `git status` → `nothing to commit, working tree clean`
  - **ファイル名がズラッと出る場合は止めて相談する**（サーバー上で誰かが手直しした形跡）
- `pm2 status` → `techno-drone` が緑の `online`

**注意（2026-07-14 の教訓）**: `git status` の「Your branch is up to date with 'origin/dev'」は
**直近で `git fetch` していない限り古いキャッシュ情報の可能性がある**。実際の最新状態を必ず
`git fetch origin` してから確認すること。過去に、ローカル dev が 9 コミットも遅れているのに
「up to date」と表示され続けていたことがあった。

```bash
git fetch origin
git log origin/dev -1 --oneline
git log origin/main -1 --oneline
```

### 1-2. 本番を「main 追従」に切り替える

```bash
git checkout main
git pull origin main
```

成功の目印: `Fast-forward` と出て、ファイル名が流れる。または `Already up to date.`

- `error: Your local changes would be overwritten` が出たら止めて相談する

### 1-3. 依存パッケージを更新

```bash
npm ci
```

成功の目印: `added XXX packages` が出て `$` に戻る。`npm warn` は無視してよい。

- `npm error signal SIGINT` は Ctrl+C 等の中断信号。メモリ不足の `Killed` とは別物。
  `free -h` で Swap を確認し、問題なければ `npm ci` をやり直せば直る。
- 本コマンドは **15 分程度かかることがある**（RAM 512MB 構成のため）。想定内。
- 最後に出る `npm audit` の脆弱性件数は、**その場で `npm audit fix` しない**。
  依存関係のメジャーアップデートはビルドを壊すリスクがあるため、別途 `/plan` で対応する。

### 1-4. DB マイグレーション

```bash
npx prisma migrate deploy
npx prisma generate
```

- `migrate deploy` は成功の目印が2パターンある: `No pending migrations to apply.`（変更なし）
  または `Applying migration ...` → `All migrations have been successfully applied.`
- `migrate deploy` は既存データを消さない安全なコマンド
- `prisma generate` の成功目印は `✔ Generated Prisma Client (v...)`。バージョン更新の案内
  ボックスが出ても、今は無視してよい（別途 `/plan` で検討）

### 1-5. 本番ビルド

```bash
npm run build
```

- RAM 512MB + Swap 構成のため数分〜十数分かかる。画面が止まって見えても待つ。**Ctrl+C は厳禁**。
- 成功の目印: `✓ Compiled successfully` の後、`✓ Linting and checking validity of types` →
  `✓ Generating static pages (N/N)` まで進み、Route 一覧表が表示される。

**メモリ不足時（2026-07-14 に実際に発生）**:
`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` が
`Linting and checking validity of types` の段階で出た場合、V8 の既定ヒープ上限に達している。
まず Swap を確認:

```bash
free -h
```

Swap に 3GB 以上の余力があれば、ヒープ上限を明示的に引き上げて再実行する:

```bash
NODE_OPTIONS="--max-old-space-size=1536" npm run build
```

これは一時的なオプションでコードは変更しない。恒久対応（`package.json` の `build` スクリプトに
組み込む、または Lightsail のメモリプラン変更）は別途 `/plan` で検討する。

### 1-6. アプリを再起動

```bash
pm2 restart techno-drone
pm2 logs techno-drone --lines 30
```

- `status: online`、`↺`（再起動回数）が1増えていれば成功
- ログの `✓ Ready in ...ms` の後に新しい赤い Error が出ていないか確認（Ctrl+C で抜けてよい）
- `Failed to find Server Action "x". This request might be from an older or newer deployment.`
  は既知の bot ノイズ（STEP 3 で nginx 遮断予定）。無視してよい。

### 1-7. ブラウザで最終確認

自分の PC のブラウザで `https://techno-drone-system.com` を開く。

- 鍵マーク付きでログイン画面が出るか
- 管理者でログインできるか
- 主要画面（受講者一覧・機体管理・飛行日誌・コース管理・飛行計画）が表示されるか
- **DIPS 通報（NG#3 の修正確認）**:
  1. 未連携の飛行計画を開き「DIPSへ通報」→ フォームに入力
  2. 「通報する」→ DIPS ログイン画面へ遷移 → ログイン
  3. 元の飛行計画詳細ページに戻り、**入力していたフォーム内容が復元されているか**
     （画面に「DIPS連携が完了しました。入力内容を復元しています。」の表示が出る）
  4. （任意。実在の機体・操縦者データで実通報してよい場合のみ）再度「通報する」を押して
     DIPS API 呼び出しが成功するか。必須の確認は 3 のフォーム復元まで。E2E テスト用の
     ダミーデータでは DIPS 側バリデーションで拒否される（下記の教訓参照）

**教訓（2026-07-14）**:

- DIPS 認可の state 検証用 cookie の有効期限は **10 分**（`DIPS_STATE_COOKIE_MAX_AGE`）。
  操作の間に長い会話や中断を挟むと `?dips=state_error` で失敗する。**通報ボタンを押したら
  間を置かずログインまで一気に進めること。**
- DIPS API（`POST /api/flight-plan/register` 等）は実在しない機体データ（シリアル番号未登録等）
  だと `DipsApiError` でリジェクトされる。**E2E テスト用のダミー機体・飛行計画では実登録まで
  到達しない可能性が高い。** フォーム復元の確認までで十分なことが多い。
- DIPS の URL が `stg.uafp.dips.mlit.go.jp` であればステージング環境。本番の実システムでは
  ない点を毎回確認すること。

502 Bad Gateway が出たら:

```bash
pm2 status
pm2 logs techno-drone --lines 30
```

---

## STEP 2: DB バックアップの自動化

### 2-1. Lightsail の自動スナップショットを ON にする（画面操作）

1. インスタンス →「Snapshots」タブ
2. 「Automatic snapshots」を Enable
3. 保存時刻はデフォルトのままでよい

成功の目印: 「Enabled」表示（直近7世代を毎日自動保存、少額課金あり）

### 2-2. DB 単体の日次バックアップ

```bash
which pg_dump
mkdir -p /home/ubuntu/backups
chmod 700 /home/ubuntu/backups
```

補足: `gzip` は圧縮であって暗号化ではない。バックアップには法定保存データ（個人情報を
含みうる）が入るため、ディレクトリ 700 / ファイル 600 の権限を維持すること。サーバー外へ
コピーする場合は、暗号化されたストレージ（Lightsail スナップショット等）のみを使う。

バックアップスクリプト作成:

```bash
cat > /home/ubuntu/db-backup.sh <<'EOF'
#!/bin/bash
set -euo pipefail
umask 077
BACKUP_DIR="/home/ubuntu/backups"
STAMP=$(date +%Y%m%d-%H%M%S)
pg_dump drone_school | gzip > "$BACKUP_DIR/drone_school-$STAMP.sql.gz"
find "$BACKUP_DIR" -name 'drone_school-*.sql.gz' -mtime +14 -delete
EOF
chmod +x /home/ubuntu/db-backup.sh
```

手動テスト実行:

```bash
/home/ubuntu/db-backup.sh
ls -lh /home/ubuntu/backups/
gunzip -t /home/ubuntu/backups/drone_school-*.sql.gz && echo "OK: 壊れていません"
```

`password authentication failed` が出たら（`-h localhost` に変えるだけでは解決しない。
TCP 接続に切り替えてもパスワードの受け渡しは別途必要）:

1. `~/.pgpass` に接続情報を設定する（`<DBパスワード>` は実際の値に置き換える。
   **パスワードをチャット等に貼らないこと**）

   ```bash
   cat > /home/ubuntu/.pgpass <<'EOF'
   localhost:5432:drone_school:ubuntu:<DBパスワード>
   EOF
   chmod 600 /home/ubuntu/.pgpass
   ```

2. スクリプト内の `pg_dump drone_school` を `pg_dump -h localhost -U ubuntu drone_school` に変更する
3. cron と同じユーザー（ubuntu）のまま `/home/ubuntu/db-backup.sh` を手動実行して成功を
   確認してから、cron 登録に進む

毎日自動実行（cron、午前3時 UTC）:

```bash
crontab -l 2>/dev/null | grep -v db-backup.sh > /tmp/mycron
echo "0 3 * * * /home/ubuntu/db-backup.sh >> /home/ubuntu/backups/backup.log 2>&1" >> /tmp/mycron
crontab /tmp/mycron
rm /tmp/mycron
crontab -l
```

---

## STEP 3: nginx で bot アクセスを遮断する

error.log を埋め尽くす `Failed to find Server Action "x"` は、当アプリが使っていない
Server Action 機能を狙った bot ノイズ。nginx で門前払いにする。

⚠️ nginx 設定変更は必ずバックアップ → テスト → 反映の順で行う。

```bash
sudo cp /etc/nginx/sites-available/techno-drone-system /etc/nginx/sites-available/techno-drone-system.bak
sudo nano /etc/nginx/sites-available/techno-drone-system
```

`location / { proxy_pass http://127.0.0.1:3000; ...` の `location / {` 直後に1行追加:

```nginx
if ($http_next_action) { return 403; }
```

保存: `Ctrl+O` → `Enter` → `Ctrl+X`

```bash
sudo nginx -t
```

`syntax is ok` / `test is successful` が出たら反映:

```bash
sudo systemctl reload nginx
```

`test failed` / `emerg` が出たら反映せず復元:

```bash
sudo cp /etc/nginx/sites-available/techno-drone-system.bak /etc/nginx/sites-available/techno-drone-system
```

反映後、ブラウザでログイン確認 → 数分後に bot ノイズが増えていないか:

```bash
pm2 logs techno-drone --lines 50
```

---

## STEP 4: pm2 ログの肥大防止

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 conf pm2-logrotate
```

---

## 既知の残課題（2026-07-14 時点）

- **本番 DB に E2E テストデータが混入している**: 飛行計画・機体管理・飛行日誌の各1件
  （タイトルに `[E2E-TEST]` を含む、または「テスト飛行場」データ）。削除は本番 DB への
  直接操作となるため、別途計画してから対応する。
- DIPS 実登録の完全な成功確認は未実施（テストデータでは DIPS API のバリデーションを
  通過できないため）。正規の機体・操縦者データでの検証が別途必要。

---

## スナップショットからの復元手順（障害時）

前提: 復元に使うスナップショットが `Available` であること（`Creating...` 中は復元に使えない）。

1. **書き込みを止める**: 被害拡大を防ぐため、まず `pm2 stop techno-drone` でアプリを停止する
   （特に DB 破損が疑われる場合は、状況が分かるまで書き込みを再開しない）
2. **復元方法を選ぶ**:
   - OS・アプリごと壊れた／原因不明 → インスタンスまるごと復元（手順 3〜4）
   - DB の中身だけ壊れた → pg_dump バックアップからの DB 単体復元が速い（手順 5）
3. **インスタンス復元**: Lightsail コンソール →「Snapshots」→ 対象スナップショットの「⋮」→
   「Create new instance」。元と同等以上のプランを選んで作成する
4. **IP / DNS の付け替え**: Static IP を旧インスタンスからデタッチし、新インスタンスに
   アタッチする。Static IP を使っていない場合は DNS の A レコードを新インスタンスの
   パブリック IP に変更する（DNS 反映に時間がかかることがある）
5. **DB 単体復元**（pg_dump からの場合）: 復元は既存 DB を置き換える破壊的操作のため、
   実行前に必ず現状の DB も `/home/ubuntu/db-backup.sh` で退避してから行う。
   プレーン形式ダンプは空の DB が前提なので、迷ったら**止めて相談する**

   ```bash
   gunzip -c /home/ubuntu/backups/drone_school-<日時>.sql.gz | psql drone_school
   ```

6. **復旧確認**: `pm2 start techno-drone` → `pm2 status` が online →
   ブラウザで `https://techno-drone-system.com` にログイン → 受講者一覧・飛行計画が
   表示されることを確認する

---

## 困ったとき早見表

| 症状 | まず打つコマンド | 対処 |
|---|---|---|
| ビルドが `Killed` / heap out of memory で死ぬ | `free -h` | Swap を確認。あれば `NODE_OPTIONS=--max-old-space-size=1536` で再実行。0 なら止めて連絡 |
| `npm ci` が `SIGINT` で止まる | （再実行） | 誤操作/接続瞬断の可能性。もう一度実行するだけで直ることが多い |
| ブラウザで 502 | `pm2 status` → `pm2 logs techno-drone` | アプリ停止中。ログのエラーを確認 |
| ログインがループする | （設定確認） | `.env` の `NEXTAUTH_URL` が本番 https URL か |
| DIPS 通報後に `?dips=state_error` | （時間確認） | cookie 有効期限10分切れの可能性。通報ボタン〜ログイン完了を間を置かず一気に行う |
| DIPS 通報で `DipsApiError` | （データ確認） | 実在しない機体・シリアル番号でバリデーション拒否の可能性 |
| nginx 変更が効かない/エラー | `sudo nginx -t` | 文法エラー。バックアップから復元 |
| DIPS で `DipsConfigError` | `pm2 logs techno-drone` | `.env` の DIPS_* 不足。不足キー名がログに出る |
| どうしても分からない | — | 「スナップショットからの復元手順」参照（`Available` なスナップショットが前提）。焦らず連絡する |
