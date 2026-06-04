import { createRequire } from "node:module";
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
  // モジュール指定子をリテラルで渡すと webpack が require.resolve を静的解析し .woff を
  // バンドルしようとしてビルドが失敗する。指定子を変数に逃がして静的解析を回避する。
  const nodeRequire = createRequire(import.meta.url);
  const fontModuleSpecifier = "@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff";
  const fontPath = nodeRequire.resolve(fontModuleSpecifier);
  Font.register({
    family: "NotoSansJP",
    src: fontPath,
  });
  fontRegistered = true;
}

export class ReactPdfLedgerGenerator implements CertificateLedgerPdfGenerator {
  async generate(input: CertificateLedgerInput): Promise<Buffer> {
    await ensureFontRegistered();
    const [{ pdf }, { CertificateLedgerPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/CertificateLedgerPDF"),
    ]);

    const element = createElement(CertificateLedgerPDF, input);
    const instance = pdf(element as never);
    return instance.toBuffer() as unknown as Promise<Buffer>;
  }
}
