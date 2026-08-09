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
git rev-list --left-right --count HEAD...origin/main
```

- 出力は `<左>\t<右>`（左: ローカル `main` だけにあるコミット数 / 右: `origin/main` だけに
  あるコミット数）。**左が 0 でない場合は停止して相談する**（サーバー上のローカル `main` に
  未公開のコミットがある状態で、`git status` が `clean` でも起こりうる。この状態のまま
  `git pull` すると分岐した履歴を merge commit で取り込んでしまい、本番に意図しない内容が
  反映される。`--ff-only` を付けるだけでは、ローカルが単純に先行しているだけのケースを
  検出できない）
- 左が 0 であることを確認できたら、fast-forward のみを許可して取り込む:

```bash
git pull --ff-only origin main
```

成功の目印: `Fast-forward` と出て、ファイル名が流れる。または `Already up to date.`

- `error: Your local changes would be overwritten` や `fatal: Not possible to fast-forward,
  aborting.` が出たら止めて相談する

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

実行前提: STEP 0-2 のスナップショットが `Available`（DB を含めて復元できる状態）であること。

```bash
npx prisma migrate deploy
npx prisma generate
```

- `migrate deploy` は成功の目印が2パターンある: `No pending migrations to apply.`（変更なし）
  または `Applying migration ...` → `All migrations have been successfully applied.`
- **`migrate deploy` を無条件に「安全なコマンド」とは考えない**。未適用のマイグレーション SQL
  をそのまま実行するコマンドであり、列のリネーム・削除など既存データに影響しうる変更が
  含まれる場合がある（実際に本リポジトリの `prisma/migrations/` にも列リネームを含む
  マイグレーションが存在する）。上記のスナップショット（バックアップ）が `Available` である
  ことを実行前に確認し、想定外のエラーが出た場合は自己判断で `migrate resolve` 等を叩かず
  止めて相談する
- `prisma generate` の成功目印は `✔ Generated Prisma Client (v...)`。バージョン更新の案内
  ボックスが出ても、今は無視してよい（別途 `/plan` で検討）

### 1-5. 本番ビルド

**メモリ不足対策は恒久化済み（2026-07-27）**:
2026-07-14 に `Linting and checking validity of types` の段階で
`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` が発生した。
以後、手動で `NODE_OPTIONS="--max-old-space-size=1536"` を都度入力する運用だったが、
`package.json` の `build` スクリプトに組み込み、**`npm run build` を打つだけで自動的に
ヒープ上限 1536MB で実行される**ようにした（手動指定は不要）。

```json
"build": "NODE_ENV=production NODE_OPTIONS=--max-old-space-size=1536 next build",
```

- **1536MB という値の根拠**: 2026-07-14 の障害発生時に、この値で再実行して成功したことが
  唯一の根拠であり、理論的な算出値ではない（暫定対応時からの値をそのまま踏襲）
- **注意（物理メモリを超える設定）**: 本番機の物理 RAM は 512MB のみで、1536MB は
  物理メモリを大きく超える。つまりこの設定は **Swap 前提**であり、Swap 領域が
  枯渇している状態で実行すると同じ heap out of memory、または OOM Killer による
  プロセス強制終了が再発しうる。**そのため `npm run build` を打つ前に、必ず下記で Swap の
  空きを確認する**
- 値そのものの見直し（引き下げ・Swap 拡張・Lightsail のメモリプラン変更）は
  運用判断が必要なため本対応の範囲外。異常が再発した場合は `free -h` の出力を添えて相談する

**ビルド前に Swap の空きを確認する（必須。この確認より先に `npm run build` を実行しない）**:

```bash
free -h
```

- 本番機の Swap は 4GB 構成（2026-07 実測: 空き約 3.7GB）。**Swap の空きが 3GB を下回って
  いる場合、または `Swap` の行が `0B` 等で無効になっている場合は、ビルドを実行せず止めて
  相談する**（Swap 拡張やプロセスの見直しが必要な兆候）

確認して問題なければビルドを実行する:

```bash
npm run build
```

- RAM 512MB + Swap 構成のため数分〜十数分かかる。画面が止まって見えても待つ。**Ctrl+C は厳禁**。
- 成功の目印: `✓ Compiled successfully` の後、`✓ Linting and checking validity of types` →
  `✓ Generating static pages (N/N)` まで進み、Route 一覧表が表示される。

それでも `heap out of memory` や `Killed` が再発した場合は、事前確認の時点から Swap 消費が
急増した可能性がある。再度 `free -h` を確認し、Swap 拡張や Lightsail のメモリプラン変更を
検討する（別途 `/plan` で対応）。

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
- **DIPS 通報（OAuth 復帰後の自動再送信の確認。PR #78 で dipsFlightPlanId を確認し重複通報を
  防止済み）**:
  1. 未連携の飛行計画を開き「DIPSへ通報」→ フォームに入力
  2. 「通報する」→ DIPS ログイン画面へ遷移 → ログイン
  3. 元の飛行計画詳細ページに戻り、通報が**自動で再送信される**ことを確認する。
     成功すると画面に「DIPS連携が完了し、飛行計画の通報を自動で送信しました。」の表示が出る
  4. 入力内容の不備や自動再送信自体の失敗（DIPS 側のバリデーション拒否等）でエラー表示に
     なった場合**のみ**、内容を確認のうえ「DIPSへ通報」→「通報する」で手動送信する
  5. 最終確認として、ページ上部の表示が「DIPS通報済み (飛行計画ID: ...)」に変わり、
     「DIPSへ通報」ボタン自体が表示されなくなっていることを確認する

  **してはいけないこと**: 3 で自動再送信が**成功**した後に、確認目的で改めて
  「DIPSへ通報」→「通報する」を押さない。自動再送信の成功時点で DIPS API 呼び出しは
  完了しており、再度押すと DIPS へ重複して通報してしまう。

**教訓（2026-07-14）**:

- DIPS 認可の state 検証用 cookie の有効期限は **10 分**（`DIPS_STATE_COOKIE_MAX_AGE`）。
  操作の間に長い会話や中断を挟むと `?dips=state_error` で失敗する。**通報ボタンを押したら
  間を置かずログインまで一気に進めること。**
- DIPS API（`POST /api/flight-plan/register` 等）は実在しない機体データ（シリアル番号未登録等）
  だと `DipsApiError` でリジェクトされる。**E2E テスト用のダミー機体・飛行計画では自動再送信が
  失敗表示になる可能性が高い。** その場合は上記 4 の手動送信の手順で確認する。
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

## 既知の残課題（2026-07-18 時点）

- ~~**本番 DB に E2E テストデータが混入している**~~ → **2026-07-18 削除完了**。
  `flight_inspections` 12件・`flight_logs` 1件・`flight_plans` 1件・`aircrafts` 1件を
  1トランザクションで削除。削除後の再 SELECT で対象4テーブルすべて0件を確認し、
  本番管理画面でも目視確認済み。
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
   `db-backup.sh` が作るのはプレーン形式ダンプ（`pg_dump drone_school | gzip > ...`）で、
   **空の DB への投入が前提**。既存の `drone_school` にそのまま流し込むとテーブル重複等の
   エラーで失敗し、中途半端に一部だけ投入された状態になりかねない。迷ったら**止めて相談する**

   アプリを止めた状態（手順1で `pm2 stop` 済み）で、空の `drone_school` を作り直してから
   復元する:

   ```bash
   dropdb drone_school
   createdb drone_school
   gunzip -c /home/ubuntu/backups/drone_school-<日時>.sql.gz \
     | psql -v ON_ERROR_STOP=1 --single-transaction drone_school
   ```

   - `dropdb` / `createdb` は `pg_dump drone_school` と同じ接続（`ubuntu` ロール、
     `DATABASE_URL=postgresql://ubuntu@localhost/drone_school`）で実行できる想定。
     権限エラーが出たら止めて相談する
   - `-v ON_ERROR_STOP=1 --single-transaction` により、投入中にエラーが起きた時点で処理が
     止まり、それまでの変更もロールバックされる（中途半端な状態の DB が残ることを防ぐ）。
     エラーで止まった場合も**止めて相談する**（`drone_school` は空のままなので、退避しておいた
     現状バックアップから戻せる状態を保っている）
   - 成功の目印: エラーなくプロンプトに戻る

6. **復元結果の確認**（アプリを再起動する前に、DB 単体で確認する）:

   ```bash
   psql drone_school -c "\dt"
   psql drone_school -c "SELECT count(*) FROM users;"
   ```

   - `\dt` でアプリのテーブル（`users` / `flight_plans` / `aircrafts` 等）が揃っているか、
     `count(*)` が 0 件や想定より大きくずれた値になっていないかを確認する
   - 想定と異なる場合はアプリを再起動せず**止めて相談する**

7. **復旧確認**: `pm2 start techno-drone` → `pm2 status` が online →
   ブラウザで `https://techno-drone-system.com` にログイン → 受講者一覧・飛行計画が
   表示されることを確認する

---

## 困ったとき早見表

| 症状 | まず打つコマンド | 対処 |
|---|---|---|
| ビルドが `Killed` / heap out of memory で死ぬ | `free -h` | `npm run build` は既定でヒープ上限 1536MB（`package.json` 側で自動設定済み・手動指定不要）。それでも死ぬ場合は Swap を確認。0 なら止めて連絡 |
| `npm ci` が `SIGINT` で止まる | （再実行） | 誤操作/接続瞬断の可能性。もう一度実行するだけで直ることが多い |
| ブラウザで 502 | `pm2 status` → `pm2 logs techno-drone` | アプリ停止中。ログのエラーを確認 |
| ログインがループする | （設定確認） | `.env` の `NEXTAUTH_URL` が本番 https URL か |
| DIPS 通報後に `?dips=state_error` | （時間確認） | cookie 有効期限10分切れの可能性。通報ボタン〜ログイン完了を間を置かず一気に行う |
| DIPS 通報で `DipsApiError` | （データ確認） | 実在しない機体・シリアル番号でバリデーション拒否の可能性 |
| nginx 変更が効かない/エラー | `sudo nginx -t` | 文法エラー。バックアップから復元 |
| DIPS で `DipsConfigError` | `pm2 logs techno-drone` | `.env` の DIPS_* 不足。不足キー名がログに出る |
| どうしても分からない | — | 「スナップショットからの復元手順」参照（`Available` なスナップショットが前提）。焦らず連絡する |
