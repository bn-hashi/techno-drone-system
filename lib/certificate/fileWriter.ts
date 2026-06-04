import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CertificateFileWriter } from "@/services/certificateService";
import { CERTIFICATE_OUTPUT_DIR_DEFAULT } from "@/lib/constants";

/**
 * 証明書番号から安全なファイル名 (英数字のみ) を抽出する。
 *
 * 採番ルール `第TC051526050001号` から `TC051526050001` を取り出すなど、
 * 日本語文字を含まないファイル名に変換する。
 * 抽出できない場合は cuid 風のフォールバックを使う。
 */
function buildFilename(certificateNumber: string): string {
  const ascii = certificateNumber.replace(/[^A-Za-z0-9]/g, "");
  if (ascii.length === 0) {
    return `certificate-${Date.now()}.pdf`;
  }
  return `${ascii}.pdf`;
}

/**
 * CertificateFileWriter の本番実装。
 *
 * `CERTIFICATE_OUTPUT_DIR` 環境変数があれば優先、なければ
 * `CERTIFICATE_OUTPUT_DIR_DEFAULT` (`/home/ubuntu/uploads/certificates/`) に保存する。
 * 親ディレクトリは `mkdir -p` 相当で確保する。
 */
export class LocalFsCertificateFileWriter implements CertificateFileWriter {
  async write(certificateNumber: string, buffer: Buffer): Promise<string> {
    const baseDir = process.env.CERTIFICATE_OUTPUT_DIR ?? CERTIFICATE_OUTPUT_DIR_DEFAULT;
    await mkdir(baseDir, { recursive: true });

    const filename = buildFilename(certificateNumber);
    const fullPath = path.resolve(baseDir, filename);
    await writeFile(fullPath, buffer);
    return fullPath;
  }
}
