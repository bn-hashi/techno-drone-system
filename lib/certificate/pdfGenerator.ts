import path from "node:path";
import { createElement } from "react";
import type {
  CertificatePdfGenerator,
  CertificatePdfInput,
} from "@/services/certificateService";

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
 * @fontsource/noto-sans-jp パッケージ内の woff ファイルパスを `process.cwd()` 起点で解決する。
 * 別実装に差し替えたい場合は、外部から呼び出さず Font.register を直接呼ぶこと。
 */
async function ensureFontRegistered(): Promise<void> {
  if (fontRegistered) return;
  // dynamic import: テストで vi.mock しやすく、また Edge ランタイムでバンドルを巻き込まない
  const { Font } = await import("@react-pdf/renderer");
  const fontPath = path.resolve(
    process.cwd(),
    "node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff"
  );
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
    const [{ pdf }, { CertificatePDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/CertificatePDF"),
    ]);

    const element = createElement(CertificatePDF, input);
    // @react-pdf/renderer の pdf() は ReactElement を受け取り、Document を生成する
    // 型定義が緩いため satisfies/cast で吸収
    const instance = pdf(element as never);
    return instance.toBuffer() as unknown as Promise<Buffer>;
  }
}
