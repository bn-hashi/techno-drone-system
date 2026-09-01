import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

/**
 * DIPS API の生レスポンスをエントリ単位で検証・正規化する共通エンジン。
 *
 * `lib/dips/aircraftListSchema.ts` (機体情報一覧取得) と `lib/dips/permissionsSchema.ts`
 * (許可・承認情報取得) は、識別子名とログ・エラーメッセージの名詞が違うだけで構造が
 * 完全に同一の正規化処理 (約90行) を2箇所に複製していた (2026-08-28 段階2共通化)。
 * 5-3/5-4/5-5 も同じ形を踏襲する前提で、この処理をここへ1本化する。
 *
 * 各 API 固有の事情 (レスポンスからどう配列を取り出すか、個々のエントリをどう検証するか)
 * は呼び出し側がオプションとして渡し、以下の共通部分だけをここで担う:
 * - エントリ単位の safeParse (1件の異常値が他のエントリを巻き込まない)
 * - 落としたエントリの構造化ログ (個人情報を含まない索引とキー名のみ)
 * - 全件失敗時に空配列ではなく DipsApiError を投げる判定
 *
 * PII 方針: ログ・例外メッセージには Zod のパス (キー名) と受信した型名のみを含め、
 * 受信値そのもの (個人情報を含みうる) は一切含めない (呼び出し側のスキーマ定義・
 * extractArray 実装が別途この方針を破らないようにすること)。
 */

/** 1エントリのパースに失敗した際の記録。個人情報を含みうる受信値そのものは持たない */
export interface DroppedEntry {
  /** レスポンス配列内でのインデックス (何件目のエントリか) */
  readonly index: number;
  /** 失敗原因となった Zod のパス (キー名) の一覧。値は含めない */
  readonly issuePaths: string[];
}

export interface NormalizeEntriesResult<TEntry> {
  entries: TEntry[];
  /** パースに失敗して除外したエントリの件数 (個人情報を含む生の値は保持しない) */
  excludedCount: number;
}

export interface NormalizeEntriesOptions<TEntry> {
  /** 1エントリを検証・正規化する Zod スキーマ */
  entrySchema: z.ZodType<TEntry>;
  /**
   * 生レスポンス全体からエントリ配列を取り出す。レスポンスの形状 (トップレベルが配列か、
   * オブジェクトの特定キーの下に配列があるか) は API ごとに異なるため、呼び出し側が
   * 実装する。形状が不正な場合はここで DipsApiError を投げること (エラーメッセージも
   * API ごとに異なるため呼び出し側の責務とする)。
   */
  extractArray: (raw: unknown) => unknown[];
  /** ログ・エラーメッセージに使う対象名 (例: "DIPS機体情報" / "DIPS許可・承認情報") */
  subject: string;
  /** 構造化ログの route フィールド (例: "normalizeAircraftList") */
  route: string;
}

/** レスポンスの実際の型名を返す (エラーメッセージの切り分け用。値そのものは含めない) */
export function describeReceivedType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Zod のパス (キー名) の一覧を返す。受信値そのものは一切含めない。
 *
 * エントリ自体がオブジェクトでない場合 (例: 配列の要素が文字列や数値) は `issue.path` が
 * 空配列になり、パスをそのまま `.join(".")` すると `""` (空文字) になる。障害切り分け時に
 * 「対象キー: 」と空欄になり、IP 制限で再試行しにくい本番で手がかりが得られなかったため
 * (C1 差し戻し。当初は許可・承認情報取得側のみに適用されていた)、パスが空のときは
 * 受信した型と Zod のエラーコードで代替する。
 */
function formatIssuePathList(error: z.ZodError, rawEntry: unknown): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path || `(受信した型: ${describeReceivedType(rawEntry)}, code: ${issue.code})`;
  });
}

/**
 * 生レスポンスの配列を1件ずつ検証する。配列全体を safeParse すると1件の失敗で
 * 全体が失敗扱いになるため、要素ごとに safeParse してパースできたエントリだけを集める。
 */
function parseEntries<TEntry>(
  rawEntries: readonly unknown[],
  entrySchema: z.ZodType<TEntry>
): { entries: TEntry[]; failures: DroppedEntry[] } {
  const entries: TEntry[] = [];
  const failures: DroppedEntry[] = [];

  rawEntries.forEach((rawEntry, index) => {
    const result = entrySchema.safeParse(rawEntry);
    if (result.success) {
      entries.push(result.data);
    } else {
      failures.push({ index, issuePaths: formatIssuePathList(result.error, rawEntry) });
    }
  });

  return { entries, failures };
}

/**
 * パースに失敗したエントリの情報を構造化ログに残す (本番疎通確認時の切り分け用)。
 * 個人情報の混入を防ぐため、受信値そのものは一切含めず、配列内のインデックスと
 * Zod のパス (キー名) のみを記録する。
 */
function logDroppedEntries(
  failures: readonly DroppedEntry[],
  totalCount: number,
  subject: string,
  route: string
): void {
  logger.error(`${subject}のパースで${failures.length}/${totalCount}件のエントリを除外しました`, undefined, {
    route,
    droppedEntries: failures.map((failure) => ({
      index: failure.index,
      issuePaths: failure.issuePaths,
    })),
  });
}

/**
 * DIPS API の生レスポンスを検証し、エントリ単位で正規化する。
 *
 * エントリ単位でパースし、1件のパース失敗は他のエントリを巻き込まない (パースできた
 * エントリだけを返し、失敗したエントリはログに記録して除外する)。以下の場合は
 * DipsApiError を投げる:
 * - `extractArray` がレスポンス形状の異常を検知した場合 (呼び出し側の実装に委譲)
 * - 配列に1件以上の要素があるにもかかわらず、全件のパースに失敗した (個々の異常値
 *   ではなく、レスポンス構造自体の変更を疑うべき状況のため、空配列を返して
 *   「0件」と誤解させるより502で失敗を可視化する)
 *
 * 空配列 ([]) 自体は「該当なし」の正当な応答のため、そのまま [] を返す。
 * エラーメッセージには Zod のキー名または受信した型名のみを含め、受信値 (個人情報を
 * 含みうる) は一切含めない。
 */
export function normalizeEntriesWithDiagnostics<TEntry>(
  raw: unknown,
  { entrySchema, extractArray, subject, route }: NormalizeEntriesOptions<TEntry>
): NormalizeEntriesResult<TEntry> {
  const rawEntries = extractArray(raw);

  const { entries, failures } = parseEntries(rawEntries, entrySchema);

  if (failures.length > 0) {
    logDroppedEntries(failures, rawEntries.length, subject, route);
  }

  if (entries.length === 0 && rawEntries.length > 0) {
    const failedKeys = Array.from(new Set(failures.flatMap((failure) => failure.issuePaths)));
    throw new DipsApiError(
      `${subject}の全${rawEntries.length}件のエントリでパースに失敗しました (対象キー: ${failedKeys.join(", ")})`
    );
  }

  return { entries, excludedCount: failures.length };
}
