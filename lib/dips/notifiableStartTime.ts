/**
 * 飛行予定日時 (plannedAt) が DIPS 飛行計画通報受付 API へ送信可能かを判定する下限値
 * (2026-09-11 req-014 課題3)。
 *
 * 【根拠と未確認事項】DIPS は本番の疎通確認で以下のエラーを実際に返した
 * (4日前の日時で拒否・将来日で成功):
 *
 *   {"errorMessage":"【飛行計画通報情報更新API】日付形式が不正です。予定開始時間が
 *   2日以前です。"}
 *
 * しかし「2日以前は拒否」という業務制約は FPRガイドライン v1.9 §2.3.8 の項目表には
 * 記載がない (`2日`/`日付形式`/`予定開始`/`startTime` で grep して確認済み。ヒットは
 * No.11 の項目定義のみで、そこにも制約の記載はない)。**境界の起点 (暦日単位か48時間か)・
 * 時刻の丸め・タイムゾーンはすべて未確認。**
 *
 * 【人の決定 2026-09-11】上記の不確かさを踏まえ、安全側 (planner 推奨は「前日以前を
 * 拒否」) ではなく、DIPS の実測制限に合わせて「2日前以前を拒否」(JST の暦日で当日から
 * 2日以上前は拒否。= 許容する最古の日は前日) を採用する。この決定は以下のトレードオフを
 * 受け入れている:
 * - もし実際の DIPS の境界がこれより厳しければ、検証をすり抜けた送信が DIPS 側で
 *   拒否されるだけで、現状 (本システムに検証がない状態) と同じ挙動に留まる (悪化しない)
 * - もし実際の境界がこれより緩ければ、正当な通報 (例: 一昨日実施した飛行の事後通報)
 *   を通せる
 *
 * 【境界がずれていた場合】本番の疎通確認で境界のズレが判明したら、
 * `NOTIFIABLE_START_TIME_MIN_OFFSET_DAYS` の値をここで調整すること。
 *
 * 【2026-09-12 CodeRabbit指摘4への対応】実装は「今日 - 2日 より前を拒否」(= 2日前
 * ちょうどを許容) になっており、人の決定「2日前以前を拒否」(2日前を含めて拒否。
 * 許容する最古は前日) より1日寛容な側にずれていた。`isNotifiableStartTime()` の
 * `minAllowedAt` を「前日 (OFFSET_DAYS - 1) の 0:00」に修正する。これは H-6 (DIPS の
 * 実際の規則が何かは未確認) とは別の話で、直すのは「人が決めた仕様と実装の食い違い」。
 */

const JST_OFFSET_MINUTES = 9 * 60;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

/** 通報可能な開始日時の下限オフセット (日)。JST の暦日で「今日 - この値」より前は拒否する */
export const NOTIFIABLE_START_TIME_MIN_OFFSET_DAYS = 2;

/** 指定した日時が属する JST 暦日の 0:00 (UTC の Date として返す) */
function jstMidnightOf(date: Date): Date {
  const jst = new Date(date.getTime() + JST_OFFSET_MINUTES * MILLISECONDS_PER_MINUTE);
  const jstMidnightAsIfUtc = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  // JST 前提で計算した「見かけ上の UTC 深夜0時」から JST オフセットを引き戻すと、
  // 本当の (UTC 基準の) JST 0:00 の Date が得られる
  return new Date(jstMidnightAsIfUtc - JST_OFFSET_MINUTES * MILLISECONDS_PER_MINUTE);
}

/**
 * 飛行予定日時が DIPS へ通報可能かを判定する。
 *
 * @param plannedAt 飛行計画の予定開始日時 (DB は UTC の Date)
 * @param now 現在時刻。テストで固定できるよう引数として受け取る (`vi.useFakeTimers()` に
 *   頼らない。`lib/dips/permissionApplicationSchema.ts` の `buildPermissionApplicationTestPayload`
 *   と同じ作法)
 */
export function isNotifiableStartTime(plannedAt: Date, now: Date): boolean {
  const todayJstMidnight = jstMidnightOf(now);
  // 許容する最古の日は「今日 - (OFFSET_DAYS - 1)」= 前日 0:00 (JST)。人の決定は
  // 「2日前以前を拒否」(2日前を含めて拒否) であり、拒否の起点は OFFSET_DAYS (2) 日前
  // だが、許容できる最古はその1日後 (前日) になる (2026-09-12 CodeRabbit指摘4)
  const oldestAllowedOffsetDays = NOTIFIABLE_START_TIME_MIN_OFFSET_DAYS - 1;
  const minAllowedAt = new Date(
    todayJstMidnight.getTime() - oldestAllowedOffsetDays * MILLISECONDS_PER_DAY
  );
  return plannedAt.getTime() >= minAllowedAt.getTime();
}
