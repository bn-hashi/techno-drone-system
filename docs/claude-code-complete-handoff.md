# Claude Code向け完全引き継ぎ資料

作成日: 2026-06-27  
用途: このCodexチャットで積み上げた判断、方針、未確認事項、次の作業をClaude Codeへ正確に引き継ぐための正本。  
重要: Claude CodeがこのCodexチャットのセッションIDだけで全履歴を読める前提にしない。この資料を正本として扱う。

---

## A. Claude Code向け完全引き継ぎ資料

### 0. この資料の扱い

この資料は、Claude Codeに渡すための自己完結した引き継ぎ資料です。

Claude Codeは、この資料に書かれていない過去チャット内容を推測で補完しないでください。不明点があれば、実装前に必ずユーザーへ質問してください。

今後の基本役割は次の通りです。

- Claude Code: コードベース調査、計画立案、限定された実装、検証、完了報告。
- Codex: 計画レビュー、危険検知、方針確認、次にClaude Codeへ渡すプロンプト作成。
- ユーザー: 業務仕様の最終判断、DB変更、migration、Excel import、本番操作、commit、push、deploy等の承認。

Claude Codeは、明示承認なしに次を行わないでください。

- DB変更。
- Prisma schema変更。
- migration作成または適用。
- Excel import。
- 本番DB操作。
- commit。
- push。
- PR作成。
- deploy。
- 外部送信。
- package追加や大きな依存更新。
- 既存ユーザー変更のrevert。

---

### 1. 全体目的

目的は、Claude Codeで作成した既存のLMS・管理システムに、Claude Designで作成したUI/UXを段階的に統合し、同時に既存システムに足りない業務機能を追加することです。

ただし、最優先は「既存機能を壊さないこと」です。

進め方は次の方針です。

- 既存コードベースを先に調査する。
- Claude Designの見た目を一気に全面移植しない。
- 既存の認証、認可、LMS、PDF、DB構造、service/repository構造を尊重する。
- UI変更と業務ロジック変更を同じ大きな差分に混ぜない。
- 1回に進める作業は小さいPhaseまたは小さいサブタスクに限定する。
- 各作業の前に計画を出し、作業後に差分、検証結果、未解決事項を報告する。
- Codexがレビューしてから次へ進む。

---

### 2. 役割分担

#### Claude Codeの役割

- 実際のアプリコードベースを読む。
- 計画書を作る。
- ユーザーが承認した小さな範囲だけ実装する。
- 既存パターンに合わせて最小差分で変更する。
- test、typecheck、lint、必要に応じてbuildやE2Eを実行する。
- 完了報告をCodexがレビューしやすい形式で出す。

#### Codexの役割

- Claude Codeの計画や完了報告をレビューする。
- 既存機能破壊、認可漏れ、DBリスク、migrationリスク、テスト不足を検知する。
- 次にClaude Codeへ送るプロンプトを作る。
- ユーザーの業務回答を技術計画へ落とし込む。

#### ユーザー承認が必要な場面

- DB schema変更。
- migration作成、適用。
- 本番DB操作。
- Excelデータの解析、dry-run、staging import、本番import。
- commit、push、PR、deploy。
- 限定解除コースの公開gate解除。
- 既存機能の仕様変更。
- 認可・料金・証明書・法令保存期間など、業務判断が必要な設計。

#### Claude Codeが勝手に進めてはいけないこと

- 「次のPhaseもついでに実装する」こと。
- 未確認の仕様を推測して固定すること。
- 既存テストを削除、skip、弱体化すること。
- 既存ユーザー変更を戻すこと。
- 半完成の限定解除コースを学生画面に公開すること。
- DB変更なしのPhaseでschema、migration、packageを触ること。

---

### 3. これまでの経緯

#### 3-1. anthropics/claude-plugins-official

最初に、Anthropic公式の`anthropics/claude-plugins-official`を調査しました。目的は、Claude CodeやClaude Designとの連携、公式プラグインやスキルの使い道を把握することでした。

この調査から、Claude Designで作った画面をClaude Codeへ共有し、既存コードベースと統合する進め方を検討しました。

#### 3-2. affaan-m/ECC

次に、`affaan-m/ECC`を調査しました。ECCはCodex向けのスキル、エージェント、コマンド、開発支援ルールをまとめた拡張セットとして扱いました。

この流れで、ユーザーはすでにClaude Code側にもCodex関連プラグインを入れている状態です。ただし、このCodexチャットの内容をClaude Codeが自動的に全取得できるとは考えず、引き継ぎ資料を正本にします。

#### 3-3. Claude Design共有機能

Claude Designには、画面デザインをClaude Codeへ共有する機能があります。スクリーンショットでは、次のような共有モーダルが確認されました。

- `Send to local coding agent`
- `Send to Claude Code Web`
- `Copy prompt`
- `Download zip instead`
- Design MCP connectorへの接続案内

この機能を使う場合も、既存システムの構造を無視してUIだけ貼り替えない方針にしました。Claude Designは「見た目とUXの参照元」として使い、実装は既存コードベースの責務、認可、DB、routingに合わせて段階的に行います。

#### 3-4. 事前準備として扱ったプラグイン、ECC、スキル、エージェント

以前の整理では、次の考え方を採りました。

- Claude DesignからClaude Codeへ画面を共有する。
- Claude Codeでコードベースを調査させる。
- Codex側でレビューや次プロンプト作成を行う。
- ECCやスキル、エージェントは補助として使うが、勝手な自動実装や一括承認はしない。
- 必要なコマンドはMac用に修正して案内する。

ただし、プラグインやエージェントが入っていても、既存システムを壊さないための承認境界は変えません。

#### 3-5. Mac用コマンドへの修正

ユーザーはMacで操作するため、以前の手順はMac用コマンドへ修正しました。Claude Code側のリポジトリはMac上にあり、報告では以下のようなパスが出ています。

```text
/Users/kenji/Desktop/Github_Mac/techno-drone-system
```

Claude Codeに渡すコマンドは、Windows前提ではなくMac上のshellで動く前提にしてください。ただし、この資料自体はOS依存コマンドを最小限にしています。

#### 3-6. Phase 1〜3の20画面と管理者ダッシュボードA案

ユーザーは「Phase 1〜3の20画面」を対象に、画面ごとの実装プロンプト作成を依頼しました。

管理者ダッシュボードにはA・B・C案があり、ユーザーはA案を選択しました。

確定:

- 管理者ダッシュボードはA案「アラートタイル型」。
- 最初の新規管理画面は管理者ダッシュボードA案。
- 架空データや未実装の講習、請求、監査指標を本番UIに表示しない。
- 実データだけで成立するダッシュボードにする。

#### 3-7. MVP計画 v1からv2

最初のMVP計画では、管理route統一、Design token、AgreementText、migration、routing方針などに矛盾や不足がありました。

Codexレビューで、次を指摘しました。

- `/admin/*`へ統一するA案と、別案の記述が混在していた。
- page routeとAPI routeの扱いを分ける必要がある。
- 受講生向けrouteまで誤って移設しない。
- 管理者ダッシュボードA案が最初の管理画面になっていない。
- `@fontsource/noto-sans-jp`が既にあるなら、`next/font/google`を重複導入しない。
- 既存`primary` tokenを壊さず、必要なtokenを追加する。
- AgreementTextのactive一意性、同意version追跡、updatedByが不足していた。
- migrationはadd-onlyでもリスクがあり、create-only、SQL review、backup、staging、forward fixが必要。
- commit、push、deployは承認制にする。

そのため、最初の計画は一括承認せず、v2へ修正させました。

#### 3-8. MVP計画 v2からv2.1

v2では、page routeとAPI routeの分離、middlewareを変更しない方針、旧URL redirect、`/student/courses`などが整理されました。

しかしv2.1では、コード調査結果として次が判明しました。

- `User`と`Course`の直接relationはない。
- `User.courseType`は単一の`CourseType?`。
- `courseType`は進捗計算や表示ラベルには使われていたが、当時のコードでは認可フィルタとして使われていなかった。
- 動画APIは`courseType`を検証していなかった。
- 進捗は`SubjectProgress`単位で、Course単位ではなかった。

このため、Codexは「`Course.type === User.courseType`を認可ルールにするなら、それはコード上の事実ではなく新しい業務ルールなので確認が必要」と判断しました。

ユーザー確認後、次が確定しました。

- 同じ`CourseType`のコースは、そのtypeの受講生ならすべて受講可能。
- 初学者コースと経験者コースを同時受講する可能性はない。
- 初学者コースと限定解除コースは同時受講の可能性がある。
- 経験者コースと限定解除コースは同時受講の可能性がある。

これにより、基礎コースについては`Course.type === User.courseType`を正式な業務認可ルールとして扱えるようになりました。

#### 3-9. MVP計画 v2.2

v2.2では、限定解除コースが大きく計画に入ってきました。

ユーザーの業務回答:

- 限定解除コースは1種類。
- 「夜間」と「目視外」を内包し、セットになっている。
- 管理者が受講生ごとに個別割当する。
- 割当は、受講者がドローン検定協会のスクールに通っていたか、応用技能講習を受講したことがあるか等で変わる。
- 限定解除コースの初学者:
  - 座学2時間。
  - シミュレーター2時間。
  - 実技4時間。
  - 受講日数2日間。
  - 費用123,200円。
- 限定解除コースの経験者:
  - 座学0時間。
  - シミュレーター0時間。
  - 実技4時間。
  - 受講日数1日間。
  - 費用96,800円。
- 限定解除コースの進捗、試験、修了判定は、初学者・経験者コースとは別々に管理する。

v2.2では、`CourseAssignment`、M4、M5、M6、M7などが整理されました。

ただし、Codexはv2.2をそのまま承認しませんでした。理由は、限定解除を半完成で学生へ公開するリスクがあったためです。

Codexの判断:

- 限定解除コースは、割当だけ実装して学生一覧に出すべきではない。
- 進捗、試験、修了、証明書、料金、Excel backfillが揃うまで学生公開しない。
- 限定解除管理画面を管理者ダッシュボードより先に作らない。
- Phase 0から限定解除DB変更を外す。

#### 3-10. MVP計画 v2.3

ユーザーは追加で次を回答しました。

- 123,200円、96,800円は税込。
- 既に現行料金として適用している。
- 正確な適用開始日は不明。
- 支払いは受講日の1週間前。
- 価格履歴、申込時・割当時のスナップショットは残す。
- 既存の限定解除受講生はいる。
- 既存データはExcelにある。
- Excelの詳細列や照合キーはまだ未確認。

これを受けてv2.3では、次の方針に整理されました。

- Phase 0は基礎コースの安全化とroutingのみ。
- Phase 0はDB変更なし。
- 限定解除は後続の完全実装featureへ分離。
- 限定解除は、割当、認可、進捗、試験、修了、証明書、料金、Excel backfill、E2Eが揃うまで学生へ非公開。
- Phase 1はdesign基盤。
- Phase 2最初の新規管理画面は管理者ダッシュボードA案。
- Course表現の候補は、後続featureで`Course.category(BASIC/LIMITED_REMOVAL)`追加、`Course.type` nullable化、DB CHECK制約。
- `CourseAssignment`は後続M4。
- 進捗・試験の分離はM5。
- 修了・証明書の分離はM6。
- 料金version、snapshot、支払期限はM7相当。
- Excel backfillは、受領、調査、dry-run、staging、本番import、cutoverをgateで分ける。

Codexはv2.3を「Phase 0は条件付きで開始可能」と判断しました。ただし、全Phase一括承認ではなく、サブタスク単位で進める方針です。

#### 3-11. Phase 0-1完了報告まで

CodexはClaude Code向けに、Phase 0-1「基礎コースの共通認可policyとunit test」だけを実装するプロンプトを作成しました。

Claude CodeからのPhase 0-1完了報告では、次が報告されました。

追加・変更ファイル:

- `services/courseAccessService.ts`
- `__tests__/services/courseAccessService.test.ts`
- `lib/serviceFactory.ts`

追加interface:

```ts
interface ICourseAccessService {
  canAccessCourse(userId: string, courseId: string): Promise<boolean>;
}
```

責務:

- 指定ユーザーが指定コースにアクセスできるかを判定する。
- UserやCourseの存在有無を外部に漏らさない。
- 認可できない場合は`false`。
- repository例外は握り潰さず伝播。

判定順序:

1. User存在チェック。
2. `role === STUDENT`。
3. `status === ACTIVE`。
4. `user.courseType != null`。
5. Course存在チェック。
6. `course.type != null`。
7. `course.type === user.courseType`。

追加テスト13件:

- ACTIVE BEGINNER → BEGINNER Course: true。
- ACTIVE BEGINNER → EXPERIENCED Course: false。
- ACTIVE EXPERIENCED → EXPERIENCED Course: true。
- ACTIVE EXPERIENCED → BEGINNER Course: false。
- User not found: false、courseRepo呼び出しなし。
- Course not found: false。
- `user.courseType` null: false、courseRepo呼び出しなし。
- status `PENDING_REGISTRATION`: false、courseRepo呼び出しなし。
- status `COMPLETED`: false。
- ADMIN role: false、courseRepo呼び出しなし。
- `course.type` null: false、`null === null`誤認可防止。
- userRepo例外: 伝播。
- courseRepo例外: 伝播。

実行結果:

- `npx vitest run __tests__/services/courseAccessService.test.ts`: 13件成功。
- `npx vitest run`: 123 test files中1件failed、122件passed。1299 tests中1298 passed。
- 失敗は`AdminLayout.test.tsx`の「受講者一覧」。
- Claude Codeは、git stashで自身の変更なし状態でも同様に失敗するためpre-existing failureと報告。
- commit、push、PR、deploy、DB操作は未実行。

Codexのレビュー:

- Phase 0-1の実装内容自体は方向性として妥当。
- ただし、typecheck、lint、`git diff --check`、stash復元状態、変更ファイルの厳密確認、AdminLayout failure詳細が未確認。
- Phase 0-2へ進む前に、追加検証が必要。

---

### 4. 現在の到達点

現在位置:

- Phase 0-1完了報告を受け取った段階。
- Codexレビューでは「Phase 0-1は概ね良いが、Phase 0-2へ進む前に追加検証が必要」と判断済み。

完了している可能性が高いこと:

- 基礎コース用の`canAccessCourse` service実装。
- 対応unit test 13件。
- `serviceFactory`への登録。

まだ未検証のこと:

- `git status --short`の正確な状態。
- `git stash list`の状態。
- baseline比較で作ったstashが残っていないか。
- 既存ユーザー変更が正しく復元されているか。
- `git diff --check`。
- Phase 0-1変更が本当に3ファイルだけか。
- typecheck。
- lint。
- full unit test失敗の詳細。
- `AdminLayout.test.tsx` failureが本当に今回差分と無関係か。
- Phase 0-2でpolicyを接続すべき入口の分類。
- policyをrouteだけに置くのか、service境界に置くのかの推奨。

次にやるべきこと:

- Phase 0-1追加検証のみ。
- Phase 0-2の実装にはまだ入らない。
- 追加検証結果をCodexへ戻してレビューする。

まだPhase 0-2へ進んでよいか:

- 現時点では、まだ進まない。
- 追加検証が通り、Codexが確認してからPhase 0-2実装プロンプトを作成する。

---

### 5. 確定済みの業務ルール

#### 基礎コース

- 同じ`CourseType`のコースは、そのtypeの受講生ならすべて受講可能。
- 初学者コースと経験者コースを同時受講する可能性はない。
- 基礎コースの認可は、`Course.type === User.courseType`を正式な業務ルールとして扱う。

#### 限定解除コース

- 限定解除コースは1種類。
- 「夜間」と「目視外」を内包し、セットになっている。
- 初学者・経験者の基礎コースとは別に、同時受講する可能性がある。
- 管理者が受講生ごとに個別割当する。
- 受講者がドローン検定協会のスクールに通っていたか、応用技能講習を受講したことがあるか等で扱いが変わる。

限定解除コースの初学者:

- 座学2時間。
- シミュレーター2時間。
- 実技4時間。
- 受講日数2日間。
- 費用123,200円。

限定解除コースの経験者:

- 座学0時間。
- シミュレーター0時間。
- 実技4時間。
- 受講日数1日間。
- 費用96,800円。

料金:

- 税込み。
- すでに現行料金として適用済み。
- 正確な適用開始日は不明。
- 架空の日付を入れない。
- 将来料金変更に備え、申込・割当時点の料金snapshotを残す。

支払い:

- 受講日の1週間前に支払う。
- 現時点では「受講開始予定日の7暦日前」を候補とする。
- 営業日補正、休日、日程変更時の再計算規則は未確認。

既存データ:

- 既存の限定解除受講生は存在する。
- 既存記録はExcelにある。
- Excelの列名、形式、件数、照合キー、重複、欠損は未確認。
- Excelを受け取るまで自動backfillはできない。

進捗・試験・修了:

- 限定解除コースの進捗、試験、修了判定は、基礎コースとは別々に管理する。
- 既存modelでは完全分離できない可能性が高く、M5/M6で設計が必要。

---

### 6. 技術方針

#### Phase 0

Phase 0はDB変更なしで進める。

Phase 0で扱う内容:

- 基礎コースの共通認可policy。
- 基礎コースのIDOR対策。
- 基礎コースだけの`/student/courses`。
- 学生dashboard/StudentLayoutのlink修正。
- 管理page routeの`/admin/*`移設。
- 旧管理URLの307 redirect。
- role別E2E、動画、試験、認証の回帰確認。

Phase 0で扱わない内容:

- 限定解除コース。
- CourseAssignment。
- CourseRequirement。
- schema変更。
- migration。
- Excel import。
- 管理者ダッシュボード。
- design token。

#### Phase 1

Phase 1はdesign基盤。

扱う候補:

- design token。
- font。
- 共通UI。
- 既存画面の段階的な見た目統合。

注意:

- 既存`@fontsource/noto-sans-jp`があるなら再利用する。
- `next/font/google`を重複導入しない。
- 既存`primary` tokenを壊さない。
- 必要な`accent`や`pageBackground`等を追加する。

#### Phase 2

Phase 2の最初の新規管理画面:

- 管理者ダッシュボードA案「アラートタイル型」。

条件:

- 実データのみ使う。
- 架空タイルや未実装データを表示しない。
- 限定解除管理画面をダッシュボードより先に公開しない。

#### 後続feature: 限定解除の完全実装

限定解除は半完成で学生公開しない。

学生公開前に必要な要素:

1. 管理者による個別割当。
2. 共通認可policyの限定解除分岐。
3. 基礎とは独立した進捗。
4. 基礎とは独立した試験・合否。
5. 基礎とは独立した修了判定・証明書。
6. 料金versionと申込・割当時snapshot。
7. 既存Excelデータのbackfillと照合。
8. role別E2E、IDOR、回帰test。

#### Course.category + Course.type nullable + CHECK制約案

後続featureの候補:

- `Course.category`: `BASIC | LIMITED_REMOVAL`。
- 基礎Course: `category=BASIC`かつ`type=BEGINNER|EXPERIENCED`必須。
- 限定解除Course: `category=LIMITED_REMOVAL`かつ`type=null`。
- DB CHECK制約で不正組合せを防ぐ。

注意:

- これはPhase 0では触らない。
- `Course.type` nullable化は非add-only変更。
- generated typeと呼出し側へnull対応が広がる。
- migration前に影響箇所を`rg`で全件調査する。
- `null === null`誤認可を防ぐため、認可policyではcategoryとnon-null guardを必ず使う。

#### CourseAssignment / CourseRequirement / M5 / M6 / M7

M4:

- `CourseAssignment`。
- 限定解除コースを管理者が個別割当するためのtable候補。
- ACTIVE割当は同一user・courseで最大1件。
- 再受講履歴はattempt等で保持。
- ACTIVE一意性はPostgreSQL partial unique index等を検討。
- `assignedById`はnullable FK、`assignedByName`はsnapshot候補。
- User削除時の扱いは法令・保存期間確認が必要。

M5:

- 進捗、試験のcourse/assignment scope分離。
- `SubjectProgress(userId, subjectId)`のままでは基礎と限定解除を分けられない。
- 既存進捗を単一Courseへ機械的にbackfillしない。

M6:

- 修了判定・証明書の分離。
- 既存`CompletionCertificate.userId @unique`は1ユーザー1通前提。
- 限定解除を別に持つには、既存table一般化または限定解除用別tableが必要。
- `@unique`解除など非add-only変更は再承認gateが必要。

M7:

- `CourseRequirement`等による料金、時間、日数、支払期限のversion管理。
- 申込・割当時点のsnapshot保持。
- 現行料金の正確な適用開始日は不明として扱う。
- 将来versionでは適用開始日の必須化を検討する。

---

### 7. 認可方針

#### 基礎コースの認可ルール

基礎コースへアクセスできる条件:

```text
Userが存在する
かつ role === STUDENT
かつ status === ACTIVE
かつ User.courseType != null
かつ Courseが存在する
かつ Course.type != null
かつ Course.type === User.courseType
```

Phase 0-1では、この条件を`canAccessCourse(userId, courseId)`として実装したと報告されています。

#### 限定解除コースの認可ルール

後続featureでの最終方針候補:

```text
ACTIVEなSTUDENT
かつ Course.category === LIMITED_REMOVAL
かつ 有効なCourseAssignment(status=ACTIVE)が存在
```

ただし、限定解除のschemaは未確定なので、Phase 0では実装しない。

#### canAccessCourseの責務

責務:

- 指定ユーザーが指定コースにアクセスできるかだけを判定する。
- 存在有無を外部へ漏らさない。
- 認可不可は原則`false`。
- repository例外は既存規約に従い、握り潰さず伝播する。

将来:

- 基礎分岐と限定解除分岐を同じpolicyへ集約する。
- Client側で隠すだけにしない。
- page、API、service境界で同じpolicyを使う。

#### 403/404方針

Q12の確定方針:

- 入力形式不正: 400。
- 未認証: 既存規約の401またはlogin誘導。
- role/status不許可: 403。
- 存在しない、別CourseType、未割当のCourse/Video: 404。

学生向けresource accessでは、存在しない場合と権限がない場合を外部から区別しにくくし、IDORによる情報漏洩を避ける。

#### IDOR対策で注意すべき点

一覧画面で非表示にするだけでは不十分です。利用者は直接URLやAPIを呼べます。

Phase 0-2以降で確認・接続対象になる可能性がある入口:

- Course page。
- `/api/student/courses/[courseId]/videos`。
- `/api/student/videos/[id]`。
- viewing-log更新API。
- fraud-flag更新API。
- その他、courseIdまたはvideoIdを受け取り、Course/Video resourceへアクセスする処理。

注意:

- 全routeへ機械的に12件接続するのではなく、入口を分類する。
- Course/Video IDを受け取る入口にはpolicyが必要。
- 自分のUser IDだけを扱いownership検証済みの入口には不要な場合がある。
- Course scope自体が将来M5対象の入口は、今のPhaseで無理に一般化しない。
- Course非依存の入口は変更不要。

---

### 8. Phase 0-1完了報告レビュー

Claude Code報告上の変更:

- `services/courseAccessService.ts`新規。
- `__tests__/services/courseAccessService.test.ts`新規。
- `lib/serviceFactory.ts`修正。

良い点:

- 実装範囲がPhase 0-1に限定されている。
- `canAccessCourse(userId, courseId): Promise<boolean>`という小さい責務になっている。
- User/Course不存在をfalseへ統一している。
- BEGINNER/EXPERIENCEDの正方向・逆方向をテストしている。
- STUDENT以外、ACTIVE以外、courseTypeなしを拒否している。
- `course.type null`を拒否し、将来の`null === null`誤認可を防ぐtestがある。
- 不要な場合にCourse repositoryを呼ばないearly returnをtestしている。
- repository例外をfalseへ変換せず伝播している。
- commit、push、PR、deploy、DB操作をしていない。

未確認点:

- typecheckとlintの結果が報告されていない。
- full testは完全成功ではなく、1件pre-existing failureと報告されているだけ。
- `git stash`を使ったbaseline比較後、worktreeとstashが安全に戻っているか不明。
- `git diff --check`未確認。
- 最終変更ファイルが本当に3件だけか未確認。
- `AdminLayout.test.tsx` failureの詳細が不足している。
- Phase 0-2対象入口の分類がまだない。

結論:

- Phase 0-1の方向性は良い。
- ただしPhase 0-2へ進む前に追加検証が必要。

---

### 9. Phase 0-1後に必要な追加検証

次の検証だけを行う。

- `git status --short`
- `git stash list`
- `git diff --check`
- Phase 0-1で変更されたファイルが本当に3件だけか。
- targeted unit test。
- typecheck。
- lint。
- full unit test。
- `AdminLayout.test.tsx`の既存fail詳細。
- stashを勝手にapply/pop/dropしないこと。
- 新しいstashを作らないこと。
- Phase 0-2の対象入口分類だけ行うこと。
- まだPhase 0-2の実装はしないこと。

Phase 0-2へ進める条件:

- targeted 13 testが成功。
- typecheck成功、または今回差分と無関係な既存失敗として明確に切り分け済み。
- lint成功、または今回差分と無関係な既存失敗として明確に切り分け済み。
- `git diff --check`成功。
- 変更が意図した3ファイルだけ、またはそれ以外は既存差分として明確に切り分け済み。
- stash操作で既存変更が失われていない。
- AdminLayoutの既存失敗が報告に残っている。
- Course-bound入口の分類が完了している。

---

### 10. Claude Codeへの運用ルール

必ず守ること:

- 1回に進める作業は小さくする。
- 実装前に計画を出す。
- 実装後に差分、テスト結果、未解決事項を報告する。
- コード変更範囲を明記する。
- DB変更なしのPhaseではschema、migration、packageを触らない。
- commit、push、deployしない。
- 不明点は推測で進めず質問する。
- 既存機能を壊す可能性がある場合は停止する。
- 既存のユーザー変更を勝手に戻さない。
- テストを削除、skip、弱体化しない。
- 古いプロンプトより最新計画とこの引き継ぎ資料を優先する。

停止条件:

- DB変更が必要になった。
- package追加が必要になった。
- 認可仕様が不明。
- 既存service/repository間に循環依存が起きる。
- 既存テストの大きな失敗が今回scopeと切り分けられない。
- 半完成の限定解除を公開しそうになる。
- Phase範囲を超える修正が必要になる。

停止した場合:

- 推測で広げない。
- 事実、原因、選択肢、質問を報告する。

---

## B. Claude Code向けPhase 0-1追加検証プロンプト

以下を、そのままClaude Codeへ貼ってください。

```text
Phase 0-1の実装をPhase 0-2へ進める前に、追加検証だけを行ってください。

重要:
- 今回は検証のみです。
- Phase 0-2の実装には入らないでください。
- 新規route接続、routing移設、DB変更、Prisma schema変更、migration、限定解除、design変更、管理者ダッシュボード実装には進まないでください。
- commit、push、PR、deploy、DB操作は行わないでください。
- 既存のユーザー変更を戻さないでください。
- baseline確認のために新しいstashを作らないでください。
- 既存stashがあっても、勝手にapply/pop/dropしないでください。

目的:
Phase 0-1「基礎コースの共通認可policyとunit test」が安全に完了しているかを確認し、Phase 0-2へ進める状態かを判断できる報告を作ること。

確認対象:
- services/courseAccessService.ts
- __tests__/services/courseAccessService.test.ts
- lib/serviceFactory.ts

1. worktreeとstashの安全確認

次を実行し、結果を報告してください。

- git status --short
- git stash list

確認すること:
- Phase 0-1実装前から存在したユーザー変更が失われていないか。
- baseline比較で作ったstashが残っている場合、その内容・名前・現在のworktreeとの関係。
- stashを勝手にapply/pop/dropしないこと。
- untracked docsや既存の.claude変更があっても、削除・移動・上書きしないこと。
- 今回の確認のために新しいstashを作らないこと。

2. diff確認

次を実行してください。

- git diff --check

また、Phase 0-1による変更が次の3ファイルだけか確認してください。

- services/courseAccessService.ts
- __tests__/services/courseAccessService.test.ts
- lib/serviceFactory.ts

それ以外に差分がある場合は、今回のPhase 0-1差分なのか、既存差分なのかを切り分けて報告してください。勝手に戻さないでください。

上記3ファイルのdiffを読み返し、次がないか確認してください。

- 不要な大規模refactor。
- debug出力。
- 型逃げのany。
- 認可条件の重複や不整合。
- repository例外を握り潰す処理。
- UserやCourseの存在情報を外部へ漏らす設計。
- 将来Course.typeがnullableになった時のnull同士誤認可。

3. 検証コマンド

repoのREADME、package scripts、既存規約を優先し、正しいコマンドを選んで次を実行してください。

1. Phase 0-1 targeted unit test。
2. TypeScript typecheck。
3. lint。
4. 可能ならfull unit test。

各コマンドについて、次を報告してください。

- 実行した正確なコマンド。
- exit code。
- 成功件数。
- 失敗件数。
- 失敗がある場合、Phase 0-1差分との関係。

typecheckまたはlintがPhase 0-1の3ファイルに起因して失敗した場合だけ、その3ファイル内で最小修正して再検証して構いません。

それ以外の既存失敗は修正せず、事実として報告してください。

4. AdminLayout.test.tsxの既存失敗確認

full unit testで失敗していると報告されたAdminLayout.test.tsxについて、コードは修正せず、次を報告してください。

- 完全なtest名。
- 期待値。
- 実際値。
- エラー要約。
- Phase 0-1の3ファイルと依存関係があるか。
- Phase 0-5の管理route移設やnavigation変更で修正対象になりそうか。
- 作業前から失敗していた根拠。ただし、新しいstash、checkout、resetは使わないでください。

5. Phase 0-2対象入口の分類だけ行う

コードは変更せず、student側の入口を次の4分類で一覧化してください。

分類1:
Course/Video IDを受け取り、Phase 0-2でcanAccessCourseが必要な入口。

分類2:
自分のUser IDだけを使い、すでにownership検証済みの入口。

分類3:
Course scope自体が将来M5以降の対象で、今は無理に一般化しない入口。

分類4:
Course非依存で変更不要の入口。

一覧には、file path、HTTP methodまたはpage名、呼び出しservice、現在の認可条件、Phase 0-2での扱い案を書いてください。

「12ルートすべて」など件数だけで機械的に決めず、実コードを読んで分類してください。

6. policyを置く推奨境界の確認

routeだけでguardするのか、service境界でもguardするのかを調査し、次を報告してください。

- 共通serviceで一度guardすればpage/API双方を守れる入口。
- route側でguardが必要な入口。
- 循環依存の可能性。
- errorを404へ変換する既存pattern。

7. 禁止操作

次は禁止です。

- Phase 0-2以降の実装。
- 新規依存追加。
- Prisma schema変更。
- migration作成または適用。
- DB操作。
- 限定解除実装。
- routing移設。
- design変更。
- 既存ユーザー変更のrevert。
- 新しいstash作成。
- stash apply/pop/drop。
- checkout/reset。
- commit、push、PR、deploy。

8. 完了報告形式

検証が終わったら停止し、Phase 0-2へは進まないでください。

報告は次の順番で出してください。

1. git status --shortの結果。
2. stashの状態と、既存変更が復元されているか。
3. Phase 0-1の最終変更ファイル。
4. git diff --check結果。
5. targeted test、typecheck、lint、full unit testの結果。
6. AdminLayout既存失敗の詳細。
7. Phase 0-2対象入口の4分類。
8. policyを置く推奨境界。
9. 検証中に追加修正した内容。なければ「なし」。
10. Phase 0-2へ進めるか。
11. commit、push、PR、deploy、DB操作をしていないこと。
```

---

## C. Codex側の今後のレビュー観点

Claude CodeからPhase 0-1追加検証報告が返ってきたら、Codexは次を確認する。

### 1. 作業範囲

- Phase 0-1追加検証だけで止まっているか。
- Phase 0-2実装に入っていないか。
- routing、DB、schema、migration、限定解除、design、dashboardに触っていないか。
- commit、push、PR、deploy、DB操作をしていないか。

### 2. worktreeとstash

- `git status --short`が報告されているか。
- `git stash list`が報告されているか。
- baseline比較で作ったstashの扱いが明確か。
- stashをapply/pop/dropしていないか。
- 新しいstashを作っていないか。
- 既存ユーザー変更を失っていないか。

### 3. diff

- `git diff --check`が成功しているか。
- Phase 0-1の変更が3ファイルに収まっているか。
- それ以外の差分がある場合、既存差分として切り分けられているか。
- 不要なrefactor、debug出力、型逃げ、責務混在がないか。

### 4. canAccessCourse

- 基礎コースの確定業務ルールに合っているか。
- `role === STUDENT`。
- `status === ACTIVE`。
- `user.courseType != null`。
- `course.type != null`。
- `course.type === user.courseType`。
- `null === null`誤認可を防いでいるか。
- User/Course不存在を外部へ漏らしていないか。
- repository例外を不適切にfalse化していないか。

### 5. test

- targeted 13 testが成功しているか。
- typecheckが成功しているか。
- lintが成功しているか。
- full unit testが成功、または既存失敗として明確に切り分けられているか。
- `AdminLayout.test.tsx`失敗の詳細が十分か。
- テストを削除、skip、弱体化していないか。

### 6. AdminLayout failure

- 失敗test名、期待値、実際値があるか。
- Phase 0-1差分と無関係か。
- Phase 0-5の管理route移設やnavigation更新で対応すべき可能性があるか。
- 「既存失敗」と言うだけで根拠が薄くないか。

### 7. Phase 0-2入口分類

- Course/Video IDを受け取る入口が漏れていないか。
- `/api/student/courses/[courseId]/videos`が含まれているか。
- `/api/student/videos/[id]`が含まれているか。
- viewing-log更新APIが含まれているか。
- fraud-flag等、videoId/courseId経由の更新APIが含まれているか。
- Course非依存の入口まで無理に変更対象にしていないか。
- 自分のUser IDだけを扱う入口が正しく分類されているか。

### 8. policy配置

- routeだけにguardを置いて迂回可能になっていないか。
- service境界で守る方が自然な入口が整理されているか。
- page/API双方で同じpolicyを使える設計か。
- 循環依存の危険がないか。
- 404変換の既存patternを確認しているか。

### 9. Phase 0-2へ進む判断

Phase 0-2へ進める条件:

- Phase 0-1差分に問題がない。
- 検証コマンドが通っている、または既存失敗が明確に切り分けられている。
- worktreeとstashが安全。
- Phase 0-2対象入口分類が妥当。
- policy配置方針が妥当。
- DB変更、schema変更、限定解除、routing移設が混ざっていない。

条件を満たす場合:

- CodexがPhase 0-2実装プロンプトを作る。
- Phase 0-2は、Course/Video resource accessへの`canAccessCourse`接続に限定する。
- DB変更なし。
- 限定解除なし。
- routing移設なし。
- commitなし。

条件を満たさない場合:

- Phase 0-2へ進まない。
- 問題点を修正する追加プロンプトを作る。

---

## 次の一手

ユーザーは、まずBの「Phase 0-1追加検証プロンプト」をClaude Codeへ送ってください。

Claude Codeから追加検証報告が返ってきたら、その報告をCodexへ貼ってください。CodexがCの観点で確認し、Phase 0-2へ進めるか、追加修正が必要かを判断します。

