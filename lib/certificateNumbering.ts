/**
 * 修了証明書採番ロジック
 *
 * 採番ルール: 第TC{機関コード4桁}{年2桁}{月2桁}{連番4桁}号
 * - 機関コード: 0515 (固定)
 * - 年: 西暦下2桁
 * - 月: 2桁ゼロ埋め
 * - 連番: 同月内発行件数で4桁ゼロ埋め
 * 例: 第TC051524091142号
 */

export interface FormatCertificateNumberInput {
  institutionCode: string;
  issuedAt: Date;
  sequence: number;
}

export interface ParsedCertificateNumber {
  institutionCode: string;
  year: string;
  month: string;
  sequence: number;
}

/**
 * JST (Asia/Tokyo) での年月を取得する
 * サーバーのタイムゾーン依存を回避するため、明示的にJSTで日付を計算
 */
function getJSTYearMonth(date: Date): { year: string; month: string } {
  const jstFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  const parts = jstFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;

  if (!year || !month) {
    throw new Error(
      `Failed to extract year/month from Intl.DateTimeFormat.formatToParts() for date: ${date.toISOString()}`
    );
  }

  return {
    year: year.slice(-2),
    month,
  };
}

/**
 * 証明書番号を生成する
 */
export function formatCertificateNumber(input: FormatCertificateNumberInput): string {
  const { institutionCode, issuedAt, sequence } = input;
  const { year, month } = getJSTYearMonth(issuedAt);
  const seq = String(sequence).padStart(4, "0");
  return `第TC${institutionCode}${year}${month}${seq}号`;
}

/**
 * 修了日から有効期限を計算する（JST を基準）
 * 有効期限: 修了日から1年後の前日
 * 例: 2024/09/25 → 2025/09/24
 *
 * JST での日付を基準に計算するため、入力Date をJST文字列に変換してから計算
 */
export function calculateExpiryDate(issuedAt: Date): Date {
  // JST での日付文字列を取得（YYYY-MM-DD形式）
  const jstFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  const jstDateStr = jstFormatter.format(issuedAt);
  const [year, month, day] = jstDateStr.split("-").map(Number);

  // 1年後の前日を計算（UTC で計算し、JST での日付を返す）
  const expiry = new Date(
    `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`
  );
  expiry.setUTCDate(expiry.getUTCDate() - 1);

  return expiry;
}

/**
 * 証明書番号を解析する
 */
export function parseCertificateNumber(certificateNumber: string): ParsedCertificateNumber {
  // フォーマット: 第TC{4桁}{2桁}{2桁}{4桁}号
  const pattern = /^第TC(\d{4})(\d{2})(\d{2})(\d{4})号$/;
  const match = certificateNumber.match(pattern);

  if (!match) {
    throw new Error(`Invalid certificate number format: ${certificateNumber}`);
  }

  return {
    institutionCode: match[1],
    year: match[2],
    month: match[3],
    sequence: parseInt(match[4], 10),
  };
}
