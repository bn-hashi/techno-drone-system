import { createElement } from "react";
import { resolveNotoSansJpFontPath } from "@/lib/certificate/fontPath";
import type { CertificatePdfGenerator, CertificatePdfInput } from "@/services/certificateService";

/**
 * CertificatePdfGenerator の本番実装。
 *
 * @react-pdf/renderer を使って React コンポーネントを Buffer に変換する。
 * Font.register は module 初回ロード時に 1 回だけ実行される。
 *
 * 注意: 本実装は Node.js ランタイム専用 (Edge ランタイムでは動かない)。
 * 呼び出し側の API ルート / Server Action で `export const runtime = "nodejs"` を付ける。
 */

let fontRegistered = false;

/**
 * NotoSansJP フォントを @react-pdf/renderer に 1 回だけ登録する。
 *
 * フォントパス解決は lib/certificate/fontPath に一元化している
 * (env override + 存在チェック付き。Next 本番バンドルでの解決失敗を回避)。
 */
async function ensureFontRegistered(): Promise<void> {
  if (fontRegistered) return;
  // dynamic import: テストで vi.mock しやすく、また Edge ランタイムでバンドルを巻き込まない
  const { Font } = await import("@react-pdf/renderer");
  Font.register({
    family: "NotoSansJP",
    src: resolveNotoSansJpFontPath(),
  });
  fontRegistered = true;
}

export class ReactPdfCertificateGenerator implements CertificatePdfGenerator {
  async generate(input: CertificatePdfInput): Promise<Buffer> {
    await ensureFontRegistered();
    // dynamic import で SSR バンドル時の循環参照を避ける
    const [{ renderToBuffer }, { CertificatePDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/CertificatePDF"),
    ]);

    const element = createElement(CertificatePDF, input);
    // renderToBuffer は Promise<Buffer> を返す。pdf(...).toBuffer() は Node ストリーム
    // (PDFDocument) を返すため、Buffer を期待する呼び出し側 (fileWriter 等) で壊れる。
    // CertificatePDF は実体として Document を返すが props 型が DocumentProps と一致しないため、
    // 型不一致を隠す `as never` ではなく renderToBuffer の引数型へ最小キャストする。
    return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
  }
}
