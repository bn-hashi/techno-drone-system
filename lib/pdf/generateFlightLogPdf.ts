import { createElement } from "react";
import { resolveNotoSansJpFontPath } from "@/lib/certificate/fontPath";
import type { FlightLogPdfProps } from "@/components/pdf/FlightLogPdf";

/**
 * 飛行日誌 様式1 PDF を生成する。
 *
 * lib/certificate/pdfGenerator.ts と同じ構成:
 * - Font.register は module 初回ロード時に 1 回だけ実行
 * - dynamic import で Edge ランタイムへのバンドル巻き込みを回避
 * - Node.js ランタイム専用 (呼び出し側 API ルートで `export const runtime = "nodejs"` を付ける)
 */

let fontRegistered = false;

async function ensureFontRegistered(): Promise<void> {
  if (fontRegistered) return;
  const { Font } = await import("@react-pdf/renderer");
  Font.register({
    family: "NotoSansJP",
    src: resolveNotoSansJpFontPath(),
  });
  fontRegistered = true;
}

export async function generateFlightLogPdf(input: FlightLogPdfProps): Promise<Buffer> {
  await ensureFontRegistered();
  const [{ renderToBuffer }, { FlightLogPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/FlightLogPdf"),
  ]);

  const element = createElement(FlightLogPdf, input);
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
}
