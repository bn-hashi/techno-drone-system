import { existsSync } from "node:fs";

/** フォントパスを明示指定する環境変数名 (配布形態・node_modules 配置差の吸収用) */
export const CERTIFICATE_FONT_PATH_ENV = "CERTIFICATE_FONT_PATH";

/** プロジェクトルート (process.cwd()) からの NotoSansJP .woff の相対パス */
const FONT_RELATIVE_PATH =
  "node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff";

/**
 * @react-pdf/renderer に登録する NotoSansJP フォント (.woff) の絶対パスを解決する。
 *
 * 様式1 (pdfGenerator) と様式5 (ledgerPdfGenerator) で共通利用し、解決戦略を一元化する。
 *
 * 解決方針:
 * - `require.resolve` / `createRequire(import.meta.url)` は使わない。
 *   Next 本番バンドルでは import.meta.url がバンドル先を指し node_modules を解決できず
 *   実行時に "Cannot find module" となるため (node/dev では成功するので検出困難)。
 * - 既定はプロジェクトルート (process.cwd()) 基準の実行時文字列パス。
 *   実行時文字列なので webpack の静的解析対象にならず .woff もバンドルされない。
 * - 配布形態や依存配置 (pnpm hoist 等) で既定パスが合わない場合は
 *   環境変数 `CERTIFICATE_FONT_PATH` で明示的に上書きできる。
 * - 解決したパスの存在を確認し、無ければ試行パスと環境変数名を含む明確なエラーを投げる。
 */
export function resolveNotoSansJpFontPath(): string {
  const override = process.env[CERTIFICATE_FONT_PATH_ENV];
  const fontPath = override ?? `${process.cwd()}/${FONT_RELATIVE_PATH}`;

  if (!existsSync(fontPath)) {
    throw new Error(
      `NotoSansJP フォントが見つかりません: ${fontPath}。` +
        `環境変数 ${CERTIFICATE_FONT_PATH_ENV} で明示的にパスを指定するか、` +
        `@fontsource/noto-sans-jp が node_modules に存在するか確認してください。`
    );
  }

  return fontPath;
}
