import { createElement } from "react";
import type {
  CertificateLedgerPdfGenerator,
  CertificateLedgerInput,
} from "@/services/certificateLedgerService";

/**
 * CertificateLedgerPdfGenerator の本番実装 (様式5 修了証明書交付台帳)。
 *
 * @react-pdf/renderer を使って React コンポーネントを Buffer に変換する。
 * 注意: 本実装は Node.js ランタイム専用。呼び出し側の API ルートで
 * `export const runtime = "nodejs"` を付けること。
 */

let fontRegistered = false;

/** NotoSansJP フォントを 1 回だけ登録する (様式1 の pdfGenerator と同じ手順)。 */
async function ensureFontRegistered(): Promise<void> {
  if (fontRegistered) return;
  const { Font } = await import("@react-pdf/renderer");
  // フォント .woff の絶対パスをプロジェクトルート (process.cwd()) 基準で実行時に組み立てる。
  // require.resolve / createRequire(import.meta.url) は Next 本番バンドルでは動かない
  // (import.meta.url がバンドル先を指し node_modules を解決できず "Cannot find module")。
  // 実行時文字列なので webpack の静的解析対象にならず .woff もバンドルされない。
  const fontPath =
    process.cwd() +
    "/node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff";
  Font.register({
    family: "NotoSansJP",
    src: fontPath,
  });
  fontRegistered = true;
}

export class ReactPdfLedgerGenerator implements CertificateLedgerPdfGenerator {
  async generate(input: CertificateLedgerInput): Promise<Buffer> {
    await ensureFontRegistered();
    const [{ renderToBuffer }, { CertificateLedgerPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/CertificateLedgerPDF"),
    ]);

    const element = createElement(CertificateLedgerPDF, input);
    // renderToBuffer は Promise<Buffer> を返す。pdf(...).toBuffer() は Node ストリーム
    // (PDFDocument) を返すため、Buffer を期待する呼び出し側 (new Uint8Array 等) で壊れる。
    // CertificateLedgerPDF は実体として Document を返すが props 型が DocumentProps と一致しないため、
    // 型不一致を隠す `as never` ではなく renderToBuffer の引数型へ最小キャストする。
    return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
  }
}
