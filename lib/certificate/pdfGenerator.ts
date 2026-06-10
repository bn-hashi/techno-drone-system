import { createRequire } from "node:module";
import { createElement } from "react";
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
 * フォントファイルのパスは require.resolve でパッケージ解決経由で取得する。
 * これにより process.cwd() やパッケージマネージャの配置差異 (pnpm hoist 等) に
 * 依存せず実行できる。別実装に差し替えたい場合は Font.register を直接呼ぶこと。
 */
async function ensureFontRegistered(): Promise<void> {
  if (fontRegistered) return;
  // dynamic import: テストで vi.mock しやすく、また Edge ランタイムでバンドルを巻き込まない
  const { Font } = await import("@react-pdf/renderer");
  // ESM 上で Node.js の require を取得し、パッケージのファイルパスを解決する。
  // モジュール指定子をリテラルで渡すと webpack が require.resolve を静的解析し、
  // バイナリ .woff をバンドルしようとして本番ビルドが失敗する。指定子を変数に逃がして
  // 静的解析できなくすることで、実行時に Node が実パスを解決するようにする。
  const nodeRequire = createRequire(import.meta.url);
  const fontModuleSpecifier =
    "@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff";
  const fontPath = nodeRequire.resolve(fontModuleSpecifier);
  Font.register({
    family: "NotoSansJP",
    src: fontPath,
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
